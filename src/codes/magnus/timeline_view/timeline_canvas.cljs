(ns codes.magnus.timeline-view.timeline-canvas
  (:require ["three" :as three]
            [clojure.core.matrix :as mat]
            [codes.magnus.main-view.interaction.draggable :as draggable]
            [codes.magnus.main-view.interaction.pointers :as pointers]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [codes.magnus.three.common :as three-common]
            [shadow.resource :as resource]))


(defn resize!
  [{:keys [canvas renderer field-render-target]}]
  (let [canvas-width    (.-width canvas)
        canvas-height   (.-height canvas)
        expected-width  1024
        expected-height (re/rget *state :probe :n-elements)
        hidden-canvas   (.-domElement renderer)]
    (when (not= [canvas-width canvas-height]
                [expected-width expected-height])
      (set! (.-width canvas) expected-width)
      (set! (.-height canvas) expected-height)
      (set! (.-width hidden-canvas) expected-width)
      (set! (.-height hidden-canvas) expected-height)
      (.setSize renderer expected-width expected-height false)
      (.setSize field-render-target expected-width expected-height))
    ; Must have some with and height, else return false
    (> (* expected-width expected-height) 0)))

(defn calculate-field!
  [{:keys [renderer camera calculate-field-pass field-render-target]}]
  (let [{:keys [update! scene]} calculate-field-pass]
    (update!)
    (.setRenderTarget renderer field-render-target)
    (.render renderer scene camera)))

(defn postprocess-field!
  [{:keys [renderer camera postprocess-field-pass field-render-target]}]
  (let [{:keys [update! scene material]} postprocess-field-pass]
    (update!)
    (three-common/set-previous-render-texture! material field-render-target)
    (.setRenderTarget renderer nil)
    (.render renderer scene camera)))

(defn draw-field-to-canvas!
  [{:keys [renderer ctx-2d]}]
  (let [canvas (.-domElement renderer)]
    (.clearRect ctx-2d 0 0 (.-width canvas) (.-height canvas))
    (.drawImage ctx-2d canvas 0 0)))

(defn render! [render-data]
  (re/with-reactive ::resize
    (when (resize! render-data)
      (re/with-reactive ::calculate-field
        (calculate-field! render-data)
        (re/with-reactive ::postprocess-field
          (postprocess-field! render-data)
          (draw-field-to-canvas! render-data))))))


(defn init! [canvas]
  (let [hidden-canvas (.createElement js/document "canvas")
        camera        (three/OrthographicCamera. -1 1 1 -1 0.1 10)
        renderer      (three/WebGLRenderer.
                       (clj->js {:canvas             hidden-canvas
                                 :alpha              true
                                 :premultipliedAlpha false
                                 :precision          "lowp"
                                 :powerPreference    "high-performance"}))

        field-render-target
        (three/WebGLRenderTarget. 1 1 (clj->js {:magFilter three/NearestFilter
                                                :minFilter three/NearestFilter}))

        calculate-field-pass
        (three-common/create-pass
         (resource/inline "shaders/timeline.frag")
         [:u_elementsTexture :u_nElements :u_samplePoint :u_centerFrequency
          :u_pulseLength :u_soundSpeed :u_minimumTime :u_maximumTime])

        postprocess-field-pass
        (three-common/create-pass
         (resource/inline "shaders/postprocess_field.frag")
         [:u_minimumDb :u_maximumDb])
        render-data {:canvas                 canvas
                     :ctx-2d                 (.getContext canvas "2d")
                     :renderer               renderer
                     :camera                 camera
                     :field-render-target    field-render-target
                     :calculate-field-pass   calculate-field-pass
                     :postprocess-field-pass postprocess-field-pass}]
    (render! render-data)))


(defn tick [[x y] text axis]
  [:span.grid-tick
   {:class (case axis :x "x-tick" :y "y-tick")
    :style {:left x :top y}}
   text])

(defn x-ticks []
  [:div
   (let [[width height] (re/rget *state :timeline-container/size)
         tick-height 25
         min-time    0
         max-time    width
         step-size   (/ width 10)]
     (when (> step-size 10)
       (for [x (range min-time max-time step-size)]
         (tick [x (- height 13)] (str (.toFixed x 0) "ms") :x))))])

(defn time-cursor []
  (let [interval  (- (re/rget *state :maximum-time)
                     (re/rget *state :minimum-time))
        perc      (-> (re/rget *state :time)
                      (- (re/rget *state :minimum-time))
                      (/ interval))
        hovered?  (= :hovering (re/rget *state :timeline-container-draggable :fsm :current-state))
        dragging? (= :dragging (re/rget *state :timeline-container-draggable :fsm :current-state))]
    [:div.timeline-time-cursor
     {:class [(cond hovered? :timeline-time-cursor-hovering
                    dragging? :timeline-time-cursor-dragging)]
      :style {:left (str (* 100 perc) "%")
              :top  0}}]))

(defn get-pointer-pos [{:keys [event]}]
  (let [interval               (- (re/rget *state :maximum-time)
                                  (re/rget *state :minimum-time))
        width                  (.-offsetWidth (.-target event))
        height                 (.-offsetHeight (.-target event))
        pointer-pos-screen     [(.-offsetX event) (.-offsetY event)]
        pointer-pos-simulation (-> pointer-pos-screen
                                   (mat/mul [(/ interval width) (/ (re/rget *state :probe :n-elements) height)])
                                   (mat/add [(re/rget *state :minimum-time) 0]))]
    {:screen     pointer-pos-screen
     :simulation pointer-pos-simulation
     :simulation-snap-to-grid pointer-pos-simulation}))

(defn get-draggable []
  (let [n-elements (re/rget *state :probe :n-elements)
        [width height] (re/rget *state :timeline-container/size)
        interval (- (re/rget *state :maximum-time)
                    (re/rget *state :minimum-time))
        x        (-> (re/rget *state :time)
                     (+ (re/rget *state :minimum-time))
                     (/ interval)
                     (* width))]
    [{:name    :timeline-cursor
      :type    :line
      :corners [[x 0] [x height]]
      :update! (fn [previous-pos [time element] snap-to-grid]
                 (swap! *state assoc :time time))}]))


(defn init-container! [element]
  (letfn [(set-container-size! []
            (swap! *state assoc :timeline-container/size
                   [(.-offsetWidth element) (.-offsetHeight element)]))]
    (.addEventListener js/window "resize" set-container-size!)
    (set-container-size!)
    (pointers/init-pointer-event-handlers! element :timeline-container get-pointer-pos)
    (draggable/init! element :timeline-container-draggable get-draggable)))

(defn container []
  [:div#timelineContainer.stackedContainer
   {:replicant/on-mount (fn [{:replicant/keys [node]}]
                          (init-container! node))}
   [:canvas.fillSpace
    #:replicant{:key :timeline
                :on-mount (fn [{:replicant/keys [node]}]
                            (init! node))}]
   (time-cursor)
   (x-ticks)])
