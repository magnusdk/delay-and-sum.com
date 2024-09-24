(ns codes.magnus.main-view.interaction.desktop
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]
            [codes.magnus.fsm :as fsm]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.state :refer [*state]]))

(defn get-offset-pos [event]
  (let [rect   (.getBoundingClientRect (.-target event))
        page-x (+ (.-left rect) (.-pageXOffset js/window))
        page-y (+ (.-top rect) (.-pageYOffset js/window))]

    (mat/sub [(.-pageX event) (.-pageY event)]
             [page-x page-y])))

(defn send-custom-event!
  ([element type]
   (send-custom-event! element type nil))

  ([element type detail]
   (let [event (js/CustomEvent. type (js-obj "detail" detail))]
     (.dispatchEvent element event))))

(defn set-pointer-pos! [{:keys [namespace element event get-pos]}]
  (let [pointer-id (.-pointerId event)
        pointer-pos (get-pos element (get-offset-pos event))]
    (swap! *state assoc-in
           [namespace :active-pointers pointer-id]
           pointer-pos)
    pointer-pos))

(defn remove-pointer! [{:keys [namespace element event get-pos]}]
  (let [pointer-id (.-pointerId event)]
    (swap! *state update-in [namespace :active-pointers] dissoc pointer-id)
    (get-pos element (get-offset-pos event))))

(def panning-speed 2e-3)
(def scaling-speed 1e-2)

(defn handle-wheel-zoom! [{:keys [element event get-pos]}]
  (.preventDefault event)
  (let [{pointer-pos :simulation} (get-pos element (get-offset-pos event))
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
  (let [pointer-pos (set-pointer-pos! data)]
    (send-custom-event! element :interaction/start-drag {:pointer-pos pointer-pos}))
  {:target :single-touch})

(defn hover! [{:keys [element] :as data}]
  (let [pointer-pos (set-pointer-pos! data)]
    (send-custom-event! element :interaction/hover {:pointer-pos pointer-pos})))

(defn drag! [{:keys [element] :as data}]
  (let [pointer-pos (set-pointer-pos! data)]
    (send-custom-event! element :interaction/drag {:pointer-pos pointer-pos})))

(defn end-drag! [{:keys [element] :as data}]
  (let [pointer-pos (remove-pointer! data)]
    (send-custom-event! element :interaction/end-drag {:pointer-pos pointer-pos})
    {:target :idle}))


(defn init! [element namespace get-pos]
  (swap! *state assoc-in [namespace :fsm]
         (fsm/FiniteStateMachine.
          {:idle         {:wheel     handle-wheel!
                          :pointermove hover!
                          :pointerdown start-drag!}

           :wheel-pan    {:wheel    handle-wheel!
                          ::fsm/any :idle}

           :wheel-zoom   {:wheel    handle-wheel!
                          ::fsm/any :idle}

           :single-touch {:pointermove     drag!
                          :pointerup       end-drag!
                          :pointercancel   end-drag!}}
          :idle))
  (let [*registered-event-handlers (atom [])

        add-event-listener!
        (fn [listener-element type]
          (let [handler #(fsm/handle! namespace
                                      {:type    type
                                       :element element
                                       :get-pos get-pos
                                       :event   %})]
            (swap! *registered-event-handlers conj [element type handler])
            (.addEventListener listener-element (name type) handler)))]

    ; Panning and zooming on mac touchpad and zooming using mouse wheel
    (add-event-listener! element :wheel)

    ; Using the mouse on desktop
    (add-event-listener! element :pointerdown)
    (add-event-listener! js/document :pointermove)
    (add-event-listener! js/document :pointerup)
    (add-event-listener! js/document :pointercancel)

    ; Return a function for removing all event listeners
    (fn []
      (doseq [[element type handler] @*registered-event-handlers]
        (.removeEventListener element (name type) handler)
        (reset! *registered-event-handlers nil)))))
