(ns codes.magnus.main-view.interaction.pointers
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]
            [codes.magnus.db :refer [*db]]
            [codes.magnus.fsm :as fsm]
            [codes.magnus.main-view.camera :as camera]))

(defn send-custom-event!
  ([*state type]
   (send-custom-event! *state type nil))

  ([*state type data]
   (let [{:keys [element]} @*state
         event (js/CustomEvent. type (js-obj "detail" data))]
     (.dispatchEvent element event))))

(defn vec-apply
  [v f]
  (mapv f v))

(defn get-pointer-pos [*state event]
  (let [{[viewport-width viewport-height] :simulation/viewport-size} @*state
        pointer-pos-screen     [(.-offsetX event) (.-offsetY event)]
        pointer-pos-simulation (camera/transform-point
                                pointer-pos-screen
                                (camera/screen-to-world-matrix viewport-width viewport-height))
        meters-per-px           (camera/meters-per-pixel viewport-width viewport-height)
        mag-base-10             (math/log10 meters-per-px)
        mag-base-10-snap        (+ 2 (math/round (- mag-base-10 0.6)))
        simulation-snap-to-grid (-> pointer-pos-simulation
                                    (mat/mul (math/pow 10 (- mag-base-10-snap)))
                                    (vec-apply math/round)
                                    (mat/mul (math/pow 10 mag-base-10-snap)))]
    {:screen     pointer-pos-screen
     :simulation pointer-pos-simulation
     :simulation-snap-to-grid simulation-snap-to-grid}))

(defn set-pointer-pos! [*state event]
  (when-let [pointer-id (.-pointerId event)]
    (let [pointer-pos (get-pointer-pos *state event)]
      (swap! *state update-in [::active-pointers pointer-id] assoc
             :primary?    (.-isPrimary event)
             :pointer-pos pointer-pos)
      pointer-pos)))

(defn set-new-pointer-pos! [*state event]
  (when-let [pointer-id (.-pointerId event)]
    (let [pointer-pos (get-pointer-pos *state event)]
      (swap! *state update-in [::active-pointers pointer-id] assoc
             :primary?              (.-isPrimary event)
             :pointer-pos           pointer-pos
             :pointer-last-down-pos pointer-pos)
      pointer-pos)))

(defn remove-pointer! [*state event]
  (when-let [pointer-id (.-pointerId event)]
    (when-not (get-in @*state [::active-pointers pointer-id :primary?])
      (swap! *state update ::active-pointers dissoc pointer-id))
    (get-pointer-pos *state event)))

(def panning-speed 2e-3)
(def scaling-speed 1e-2)

(defn handle-wheel-zoom! [*state event]
  (.preventDefault event)
  (let [{pointer-pos :simulation} (get-pointer-pos *state event)
        scaling-factor (math/exp (* (.-deltaY event) scaling-speed))]
    (camera/scale-camera! pointer-pos scaling-factor)
    {:target :wheel-zoom}))

(defn handle-wheel-pan! [_*state event]
  (.preventDefault event)
  (let [[tx ty] (-> [(.-deltaX event) (.-deltaY event)]
                    (mat/mul (camera/camera-scale) panning-speed))]
    (camera/translate-camera! tx ty)
    {:target :wheel-pan}))

(defn handle-wheel! [*state event]
  (if (.-ctrlKey event)
    (handle-wheel-zoom! *state event)
    (handle-wheel-pan! *state event)))

(defn start-drag! [*state event]
  (let [pointer-pos (set-new-pointer-pos! *state event)]
    (send-custom-event! *state ::start-drag {:pointer-pos pointer-pos}))
  {:target :single-touch})

(defn start-multi-touch! [*state event]
  (set-new-pointer-pos! *state event)
  (send-custom-event! *state ::end-drag)
  {:target :multi-touch})

(defn handle-pointerdown-multi-touch! [*state event]
  (set-new-pointer-pos! *state event))

(defn hover! [*state event]
  (let [pointer-pos (set-new-pointer-pos! *state event)]
    (send-custom-event! *state ::hover {:pointer-pos pointer-pos})))

(defn drag! [*state event]
  (let [pointer-pos (set-new-pointer-pos! *state event)]
    (send-custom-event! *state ::drag {:pointer-pos pointer-pos})))

(defn handle-pointermove-multi-touch! [*state event]
  (set-pointer-pos! *state event))

(defn end-drag! [*state event]
  (let [pointer-pos (remove-pointer! *state event)]
    (send-custom-event! *state ::end-drag {:pointer-pos pointer-pos})
    {:target :idle}))

(defn handle-pointerup-multi-touch! [*state event]
  (remove-pointer! *state event)
  (let [{::keys [active-pointers]} @*state]
    (if (= 1 (count active-pointers))
      {:target :single-touch}
      {:target :idle})))

(defn init-pointer-event-handlers!
  [*state]
  (swap! *state assoc ::fsm
         (fsm/FiniteStateMachine.
          {:idle         {:wheel       handle-wheel!
                          :pointermove hover!
                          :pointerdown start-drag!}

           :wheel-pan    {:wheel    handle-wheel!
                          ::fsm/any :idle}

           :wheel-zoom   {:wheel    handle-wheel!
                          ::fsm/any :idle}

           :single-touch {:pointermove   drag!
                          :pointerdown   start-multi-touch!
                          :pointerup     end-drag!
                          :pointercancel end-drag!}

           :multi-touch  {:pointermove   handle-pointermove-multi-touch!
                          :pointerdown   handle-pointerdown-multi-touch!
                          :pointerup     handle-pointerup-multi-touch!
                          :pointercancel handle-pointerup-multi-touch!}}
          :idle))
  (let [{:keys [element]} @*state
        *registered-event-handlers (atom [])

        add-event-listener!
        (fn [element type]
          (let [handler #(fsm/handle! *state ::fsm {:type type :event %})]
            (swap! *registered-event-handlers conj [element type handler])
            (.addEventListener element (name type) handler)))]

    ; Panning and zooming on mac touchpad and zooming using mouse wheel
    (add-event-listener! element :wheel)
    ; Clicking and potentially starting a multi-touch gesture on mobile/tablet
    (add-event-listener! element :pointerdown)
    ; These are added to the document so that once the user has started a gesture, they 
    ; may finish it outside of the main element.
    (add-event-listener! js/document :pointermove)
    (add-event-listener! js/document :pointercancel)
    (add-event-listener! js/document :pointerup)

    ; Return a function for removing all event listeners
    (fn []
      (doseq [[element type handler] @*registered-event-handlers]
        (.removeEventListener element (name type) handler)
        (reset! *registered-event-handlers nil)))))

(comment
  ;; = swap! - Example 1 = 

  ;; make an atomic list
  (def players (atom ()))
  ;; #'user/players

  ;; conjoin a keyword into that list
  (swap! players conj :player1)
  ;;=> (:player1)

  ;; conjoin a second keyword into the list
  (swap! players conj :player2)
  ;;=> (:player2 :player1)

  ;; take a look at what is in the list
  (deref players)
  ;;=> (:player2 :player1)
  ;; See also:
  clojure.core/atom
  clojure.core/reset!
  clojure.core/compare-and-set!
  clojure.core/swap-vals!
  :rcf)

