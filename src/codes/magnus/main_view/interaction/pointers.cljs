(ns codes.magnus.main-view.interaction.pointers
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]
            [codes.magnus.fsm :as fsm]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.state :refer [*state]]))

(defn send-custom-event!
  ([element type]
   (send-custom-event! element type nil))

  ([element type detail]
   (let [event (js/CustomEvent. type (js-obj "detail" detail))]
     (.dispatchEvent element event))))

(defn set-pointer-pos! [{:keys [namespace event get-pointer-pos] :as data}]
  (when-let [pointer-id (.-pointerId event)]
    (let [pointer-pos (get-pointer-pos data)]
      (swap! *state update-in [namespace :active-pointers pointer-id] assoc
             :primary?    (.-isPrimary event)
             :pointer-pos pointer-pos)
      pointer-pos)))

(defn set-new-pointer-pos! [{:keys [namespace event get-pointer-pos] :as data}]
  (when-let [pointer-id (.-pointerId event)]
    (let [pointer-pos (get-pointer-pos data)]
      (swap! *state update-in [namespace :active-pointers pointer-id] assoc
             :primary?              (.-isPrimary event)
             :pointer-pos           pointer-pos
             :pointer-last-down-pos pointer-pos)
      pointer-pos)))

(defn remove-pointer! [{:keys [namespace event get-pointer-pos] :as data}]
  (when-let [pointer-id (.-pointerId event)]
    (when-not (get-in @*state [namespace :active-pointers pointer-id :primary?])
      (swap! *state update-in [namespace :active-pointers] dissoc pointer-id))
    (get-pointer-pos data)))

(def panning-speed 2e-3)
(def scaling-speed 1e-2)

(defn handle-wheel-zoom! [{:keys [event get-pointer-pos] :as data}]
  (.preventDefault event)
  (let [{pointer-pos :simulation} (get-pointer-pos data)
        scaling-factor (math/exp (* (.-deltaY event) scaling-speed))]
    (camera/scale-camera! pointer-pos scaling-factor)
    {:target :wheel-zoom}))

(defn handle-wheel-pan! [{:keys [event]}]
  (.preventDefault event)
  (let [[tx ty] (-> [(.-deltaX event) (.-deltaY event)]
                    (mat/mul (camera/camera-scale) panning-speed))]
    (camera/translate-camera! tx ty)
    {:target :wheel-pan}))

(defn handle-wheel! [{:keys [event] :as data}]
  (if (.-ctrlKey event)
    (handle-wheel-zoom! data)
    (handle-wheel-pan! data)))

(defn start-drag! [{:keys [element] :as data}]
  (let [pointer-pos (set-new-pointer-pos! data)]
    (send-custom-event! element ::start-drag {:pointer-pos pointer-pos}))
  {:target :single-touch})

(defn start-multi-touch! [{:keys [element] :as data}]
  (set-new-pointer-pos! data)
  (send-custom-event! element ::end-drag)
  {:target :multi-touch})

(defn handle-pointerdown-multi-touch! [data]
  (set-new-pointer-pos! data))

(defn hover! [{:keys [element] :as data}]
  (let [pointer-pos (set-new-pointer-pos! data)]
    (send-custom-event! element ::hover {:pointer-pos pointer-pos})))

(defn drag! [{:keys [element] :as data}]
  (let [pointer-pos (set-new-pointer-pos! data)]
    (send-custom-event! element ::drag {:pointer-pos pointer-pos})))

(defn handle-pointermove-multi-touch! [data]
  (set-pointer-pos! data))

(defn end-drag! [{:keys [element] :as data}]
  (let [pointer-pos (remove-pointer! data)]
    (send-custom-event! element ::end-drag {:pointer-pos pointer-pos})
    {:target :idle}))

(defn handle-pointerup-multi-touch! [{:keys [namespace] :as data}]
  (remove-pointer! data)
  (let [{:keys [active-pointers]} (get @*state namespace)]
    (if (= 1 (count active-pointers))
      {:target :single-touch}
      {:target :idle})))

(defn init-pointer-event-handlers! [element namespace get-pointer-pos]
  (swap! *state assoc-in [namespace :fsm]
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
  (let [*registered-event-handlers (atom [])

        add-event-listener!
        (fn [listener-element type]
          (let [handler #(fsm/handle! namespace
                                      {:type            type
                                       :element         element
                                       :get-pointer-pos get-pointer-pos
                                       :event           %})]
            (swap! *registered-event-handlers conj [element type handler])
            (.addEventListener listener-element (name type) handler)))]

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
