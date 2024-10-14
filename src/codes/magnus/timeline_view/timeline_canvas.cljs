(ns codes.magnus.timeline-view.timeline-canvas
  (:require ["three" :as three]
            [clojure.core.matrix :as mat]
            [codes.magnus.main-view.interaction.core :as core]
            [codes.magnus.main-view.interaction.draggable :as draggable]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [codes.magnus.three.common :as three-common]
            [shadow.resource :as resource]))

(def n-timeline-samples 2048)


(defn resize!
  [{:keys [canvas renderer field-render-target]}]
  (let [canvas-width          (.-width canvas)
        canvas-height         (.-height canvas)
        expected-width        n-timeline-samples
        expected-height       (if (= (re/rget *state :sample-timeline-at) "probe")
                                (re/rget *state :probe :n-elements)
                                256)
        render-target-height  (if (= (re/rget *state :sample-timeline-at) "probe")
                                (re/rget *state :probe :n-elements)
                                1)
        hidden-canvas         (.-domElement renderer)]
    (when (not= [canvas-width canvas-height]
                [expected-width expected-height])
      (set! (.-width hidden-canvas) expected-width)
      (set! (.-height hidden-canvas) expected-height)
      (set! (.-width canvas) expected-width)
      (set! (.-height canvas) expected-height)
      (.setSize renderer expected-width expected-height false)
      (.setSize field-render-target expected-width render-target-height))
    ; Must have some with and height, else return false
    (> (* expected-width expected-height) 0)))

(defn calculate-field!
  [{:keys [renderer camera passes field-render-target]}]
  (let [{:keys [update! scene]} (if (= (re/rget *state :sample-timeline-at) "probe")
                                  (:calculate-channel-data       passes)
                                  (:calculate-field-at-scatterer passes))]
    (update!)
    (.setRenderTarget renderer field-render-target)
    (.render renderer scene camera)))

(defn postprocess-field!
  [{:keys [renderer camera passes field-render-target]}]
  (let [{:keys [update! scene material]} (if (= (re/rget *state :sample-timeline-at) "probe")
                                           (:postprocess-channel-data       passes)
                                           (:postprocess-field-at-scatterer passes))]
    (update!)
    (three-common/set-extra-uniform! material "u_textureWidth" n-timeline-samples)
    (three-common/set-texture! material "t_simulatedField" field-render-target)
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
                                 :powerPreference    "high-performance"}))

        field-render-target
        (three/WebGLRenderTarget. 1 1)

        calculate-channel-data-pass
        (three-common/create-pass
         (resource/inline "shaders/timeline_sampled_at_probe.frag")
         [:u_elementsTexture :u_nElements :u_samplePoint :u_centerFrequency
          :u_pulseLength :u_soundSpeed :u_minimumTime :u_maximumTime
          :u_attenuationFactor])

        calculate-field-at-scatterer-pass
        (three-common/create-pass
         (resource/inline "shaders/timeline_sampled_at_scatterer.frag")
         [:u_elementsTexture :u_nElements :u_samplePoint :u_centerFrequency
          :u_pulseLength :u_soundSpeed :u_minimumTime :u_maximumTime
          :u_attenuationFactor])

        postprocess-channel-data-pass
        (three-common/create-pass
         (resource/inline "shaders/postprocess_field.frag")
         [:u_minimumDb :u_maximumDb :u_useDb :u_displayMode])

        postprocess-field-at-scatterer-pass
        (three-common/create-pass
         (resource/inline "shaders/postprocess_line_plot.frag")
         [:u_timelineGain])

        render-data {:canvas                 canvas
                     :ctx-2d                 (.getContext canvas "2d")
                     :renderer               renderer
                     :camera                 camera
                     :field-render-target    field-render-target
                     :passes                 {:calculate-channel-data         calculate-channel-data-pass
                                              :calculate-field-at-scatterer   calculate-field-at-scatterer-pass
                                              :postprocess-channel-data       postprocess-channel-data-pass
                                              :postprocess-field-at-scatterer postprocess-field-at-scatterer-pass}}]
    (render! render-data)))


(defn tick [[x y] text axis]
  [:span.grid-tick
   {:class (case axis :x "x-tick" :y "y-tick")
    :style {:left x :top y}}
   text])

(defn x-ticks []
  [:div
   (let [[width height] (re/rget *state :timeline-container/size)
         min-time    (re/rget *state :minimum-time)
         max-time    (re/rget *state :maximum-time)
         interval    (- max-time min-time)
         step-size   (/ width 5)]
     (when (> step-size 10)
       (for [x (range 0 width step-size)]
         (let [label (-> (/ x width)
                         (* interval 1e6))]
           (tick [x (- height 13)] (str (.toFixed label 0) "μs") :x)))))])

(defn time-cursor []
  (let [interval  (- (re/rget *state :maximum-time)
                     (re/rget *state :minimum-time))
        perc      (-> (re/rget *state :time)
                      (- (re/rget *state :minimum-time))
                      (/ interval))
        hovered?  (= :hovering (re/rget *state :timeline-container-draggable :fsm :current-state))
        dragging? (= :dragging (re/rget *state :timeline-container-draggable :fsm :current-state))]
    [:div.timeline-time-cursor
     {:class [(cond
                ; Timeline is always hovered since it can be "dragged" from everywhere 
                ; on the timeline. I.e.: the user can click anywhere on the timeline to 
                ; set the current time. Disregard :timeline-time-cursor-hovering class.
                ; hovered? :timeline-time-cursor-hovering
                dragging? :timeline-time-cursor-dragging)]
      :style {:left (str (* 100 perc) "%")
              :top  0}}]))


(defn get-pointer-pos [element pointer-pos-offset]
  (let [interval               (- (re/rget *state :maximum-time)
                                  (re/rget *state :minimum-time))
        width                  (.-offsetWidth element)
        height                 (.-offsetHeight element)
        pointer-pos-simulation (-> pointer-pos-offset
                                   (mat/mul [(/ interval width) (/ (re/rget *state :probe :n-elements) height)])
                                   (mat/add [(re/rget *state :minimum-time) 0]))]
    {:offset     pointer-pos-offset
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
    ; Disable :force-current-time-at-focus when changing current time
    (.addEventListener element "pointerdown" (fn [_] (swap! *state assoc :force-current-time-at-focus false)))
    (core/init! element :timeline-container get-pointer-pos false)
    (draggable/init!
     element :timeline-container-draggable get-draggable
     ; Timeline marker could be dragged from everywhere, so set hover distance to something really high :)
     :hover-distance 1e9)))

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
