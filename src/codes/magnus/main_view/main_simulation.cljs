(ns codes.magnus.main-view.main-simulation
  (:require ["three" :as three]
            [codes.magnus.main-view.common :as common]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.three.common :as three-common]
            [shadow.resource :as resource]))


(defn resize!
  [{:keys [canvas renderer field-render-target]}]
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
        (three/WebGLRenderTarget. 1 1)

        calculate-field-pass
        (three-common/create-pass
         (resource/inline "shaders/main_simulation.frag")
         [:u_cameraMatrix :u_elementsTexture :u_samplePoint :u_nElements
          :u_centerFrequency :u_pulseLength :u_time :u_soundSpeed])

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
