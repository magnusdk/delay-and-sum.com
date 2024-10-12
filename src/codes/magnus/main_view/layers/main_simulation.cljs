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
  [{:keys [renderer camera passes render-targets]} & {:keys [render-target pass]
                                                      :or   {render-target :main
                                                             pass          :calculate-field}}]
  (let [{:keys [update! scene]} (pass passes)]
    (update!)
    (.setRenderTarget renderer (render-target render-targets))
    (.render renderer scene camera)))

(defn copy-texture
  [{:keys [renderer camera passes render-targets]} from to]
  (let [{:keys [update! scene material]} (:copy-maximum-amplitude-pass passes)]
    (update!)
    (three-common/set-texture! material "t_data" (from render-targets))
    (.setRenderTarget renderer (to render-targets))
    (.render renderer scene camera)))

(defn postprocess-field!
  [{:keys [renderer camera passes render-targets]}]
  (let [{:keys [update! scene material]} (:postprocess-field passes)]
    (update!)
    (three-common/set-texture! material "t_simulatedField" (:main render-targets))
    (.setRenderTarget renderer nil)
    (.render renderer scene camera)))

(defn draw-field-to-canvas!
  [{:keys [renderer ctx-2d]}]
  (let [canvas (.-domElement renderer)]
    (.clearRect ctx-2d 0 0 (.-width canvas) (.-height canvas))
    (.drawImage ctx-2d canvas 0 0)))

(defn init-maximum-amplitude-field! [render-data]
  (calculate-field! render-data
                    :render-target :max-amplitude-current
                    :pass          :calculate-field-stochasticly)
  (swap! *state assoc ::iteration 0))

(defn calculate-maximum-amplitude-field!
  [{:keys [renderer camera passes render-targets] :as render-data}]
  (when (< (re/rget *state ::iteration) 500)
    (calculate-field! render-data
                      :render-target :max-amplitude-compare
                      :pass          :calculate-field-stochasticly)
    (let [{:keys [update! scene material]} (:select-maximum-amplitude passes)]
      (update!)
      (three-common/set-texture! material "t_data1" (:max-amplitude-compare render-targets))
      (three-common/set-texture! material "t_data2" (:max-amplitude-current render-targets))
      (.setRenderTarget renderer (:main render-targets))
      (.render renderer scene camera))
    (copy-texture render-data :main :max-amplitude-current)
    (re/with-reactive ::postprocess-field
      (postprocess-field! render-data)
      (draw-field-to-canvas! render-data))
    (swap! *state update ::iteration inc)))


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
              (postprocess-field! render-data)
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

        select-maximum-amplitude-pass
        (three-common/create-pass
         (resource/inline "shaders/select_maximum_amplitude.frag")
         [])

        copy-maximum-amplitude-pass
        (three-common/create-pass
         (resource/inline "shaders/copy_texture.frag")
         [])

        postprocess-field-pass
        (three-common/create-pass
         (resource/inline "shaders/postprocess_field.frag")
         [:u_minimumDb :u_maximumDb :u_useDb :u_displayMode])
        render-data {:canvas         canvas
                     :ctx-2d         (.getContext canvas "2d")
                     :renderer       renderer
                     :camera         camera
                     :render-targets {:main                  (three/WebGLRenderTarget. 1 1)
                                      :max-amplitude-compare (three/WebGLRenderTarget. 1 1)
                                      :max-amplitude-current (three/WebGLRenderTarget. 1 1)}
                     :passes         {:calculate-field              calculate-field-pass
                                      :calculate-field-stochasticly calculate-field-stochasticly-pass
                                      :select-maximum-amplitude     select-maximum-amplitude-pass
                                      :copy-maximum-amplitude-pass  copy-maximum-amplitude-pass
                                      :postprocess-field            postprocess-field-pass}}]
    (render! render-data)))
