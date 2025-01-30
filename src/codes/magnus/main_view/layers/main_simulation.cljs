(ns codes.magnus.main-view.layers.main-simulation
  (:require ["three" :as three]
            [codes.magnus.main-view.common :as common]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [codes.magnus.three.common :as three-common]
            [shadow.resource :as resource]))


(defn resize!
  [{:keys [canvas renderer render-targets]}]
  (let [canvas-width  (.-width canvas)
        canvas-height (.-height canvas)
        [expected-width expected-height] (common/get-expected-size)
        hidden-canvas (.-domElement renderer)]
    (when (not= [canvas-width canvas-height]
                [expected-width expected-height])
      (set! (.-width canvas) expected-width)
      (set! (.-height canvas) expected-height)
      (set! (.-width hidden-canvas) expected-width)
      (set! (.-height hidden-canvas) expected-height)
      (.setSize renderer expected-width expected-height false)
      (doseq [render-target (vals render-targets)]
        (.setSize render-target expected-width expected-height)))
    ; Must have some with and height, else return false
    (> (* expected-width expected-height) 0)))

(defn calculate-field!
  [{:keys [renderer camera passes render-targets]}]
  (let [{:keys [update! scene]} (:calculate-field passes)]
    (update!)
    (.setRenderTarget renderer (:main render-targets))
    (.render renderer scene camera)))

(defn copy-texture
  [{:keys [renderer camera passes render-targets]} from to]
  (let [{:keys [update! scene material]} (:copy-texture passes)]
    (update!)
    (three-common/set-texture! material "t_values" (from render-targets) :texture-index 0)
    (three-common/set-texture! material "t_times" (from render-targets) :texture-index 1)
    (.setRenderTarget renderer (to render-targets))
    (.render renderer scene camera)))

(defn postprocess-field-main!
  [{:keys [renderer camera passes render-targets]}]
  (let [{:keys [update! scene material]} (:postprocess-field passes)]
    (update!)
    (three-common/set-texture! material "t_simulatedField" (:main render-targets))
    (.setRenderTarget renderer nil)
    (.render renderer scene camera)))

(defn postprocess-field-max-amplitude!
  [{:keys [renderer camera passes render-targets]}]
  (if (= "time-delays" (re/rget *state :display-mode))
    (let [{:keys [update! scene material]} (:postprocess-field-time-delays passes)]
      (update!)
      (three-common/set-texture! material "t_maximumAmplitudeValues" (:max-amplitude-main render-targets) :texture-index 0)
      (three-common/set-texture! material "t_maximumAmplitudeTimes" (:max-amplitude-main render-targets) :texture-index 1)
      (.setRenderTarget renderer nil)
      (.render renderer scene camera))
    (let [{:keys [update! scene material]} (:postprocess-field passes)]
      (update!)
      (three-common/set-texture! material "t_simulatedField" (:max-amplitude-main render-targets) :texture-index 0)
      (.setRenderTarget renderer nil)
      (.render renderer scene camera))))

(defn draw-field-to-canvas!
  [{:keys [renderer ctx-2d]}]
  (let [canvas (.-domElement renderer)]
    (.clearRect ctx-2d 0 0 (.-width canvas) (.-height canvas))
    (.drawImage ctx-2d canvas 0 0)))

(defn clear-max-amplitude!
  [{:keys [renderer camera passes render-targets]}]
  (let [{:keys [update! scene]} (:clear passes)]
    (update!)
    (.setRenderTarget renderer (:max-amplitude-main render-targets))
    (.render renderer scene camera)))

(defn calculate-maximum-amplitude-field-1!
  [{:keys [renderer camera passes render-targets] :as render-data}]
  (let [{:keys [update! scene material]} (:calculate-field-stochasticly passes)]
    (update!)
    (three-common/set-texture! material "t_maximumAmplitudeValues" (:max-amplitude-main render-targets) :texture-index 0)
    (three-common/set-texture! material "t_maximumAmplitudeTimes" (:max-amplitude-main render-targets) :texture-index 1)
    (.setRenderTarget renderer (:max-amplitude-compare render-targets))
    (.render renderer scene camera))
  (copy-texture render-data :max-amplitude-compare :max-amplitude-main))

(defn calculate-maximum-amplitude-field! [render-data]
  (when (< (re/rget *state ::iteration) 500)
    (calculate-maximum-amplitude-field-1! render-data)
    (re/with-reactive ::postprocess-field
      (postprocess-field-max-amplitude! render-data)
      (draw-field-to-canvas! render-data))
    (swap! *state update ::iteration inc)))

(defn init-maximum-amplitude-field! [render-data]
  (clear-max-amplitude! render-data)
  (swap! *state assoc ::iteration 0)
  (calculate-maximum-amplitude-field-1! render-data))

(defn render! [render-data]
  (re/with-reactive ::resize
    (when (resize! render-data)
      (re/with-reactive ::check-for-maximum-amplitude-mode
        (if (re/rget *state :maximum-amplitude-simulation?)
          (do
            (init-maximum-amplitude-field! render-data)
            (re/with-reactive ::calculate
              (calculate-maximum-amplitude-field! render-data)))
          (re/with-reactive ::calculate
            (calculate-field! render-data)
            (re/with-reactive ::postprocess-field
              (postprocess-field-main! render-data)
              (draw-field-to-canvas! render-data))))))))


(defn init! [canvas]
  (let [hidden-canvas (.createElement js/document "canvas")
        camera        (three/OrthographicCamera. -1 1 1 -1 0.1 10)
        renderer      (three/WebGLRenderer.
                       (clj->js {:canvas             hidden-canvas
                                 :alpha              true
                                 :premultipliedAlpha false
                                 :powerPreference    "high-performance"}))

        calculate-field-pass
        (three-common/create-pass
         (resource/inline "shaders/main_simulation.frag")
         [:u_cameraMatrix :u_elementsTexture :u_samplePoint :u_nElements
          :u_centerFrequency :u_pulseLength :u_time :u_soundSpeed
          :u_attenuationFactor])

        calculate-field-stochasticly-pass
        (three-common/create-pass
         (resource/inline "shaders/stochastic_time_simulation.frag")
         [:u_cameraMatrix :u_elementsTexture :u_nElements :u_centerFrequency
          :u_pulseLength :u_soundSpeed :u_attenuationFactor :u_seed])

        clear-pass
        (three-common/create-pass
         (resource/inline "shaders/clear.frag")
         [])

        copy-texture-pass
        (three-common/create-pass
         (resource/inline "shaders/copy_values_and_times.frag")
         [])

        postprocess-field-pass
        (three-common/create-pass
         (resource/inline "shaders/postprocess_field.frag")
         [:u_minimumDb :u_maximumDb :u_useDb :u_displayMode])

        postprocess-field-time-delays-pass
        (three-common/create-pass
         (resource/inline "shaders/postprocess_field_time_delays.frag")
         [:u_minimumDb :u_maximumDb :u_useDb])

        render-data {:canvas         canvas
                     :ctx-2d         (.getContext canvas "2d")
                     :renderer       renderer
                     :camera         camera
                     :render-targets {:main                  (three/WebGLRenderTarget. 1 1)
                                      :max-amplitude-main    (three/WebGLRenderTarget. 1 1 (clj->js {:count 2}))
                                      :max-amplitude-compare (three/WebGLRenderTarget. 1 1 (clj->js {:count 2}))}
                     :passes         {:calculate-field               calculate-field-pass
                                      :calculate-field-stochasticly  calculate-field-stochasticly-pass
                                      :clear                         clear-pass
                                      :copy-texture                  copy-texture-pass
                                      :postprocess-field             postprocess-field-pass
                                      :postprocess-field-time-delays postprocess-field-time-delays-pass}}]
    (render! render-data)))
