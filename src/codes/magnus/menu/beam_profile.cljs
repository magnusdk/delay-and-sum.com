(ns codes.magnus.menu.beam-profile
  (:require ["three" :as three]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.three.common :as three-common]
            [shadow.resource :as resource]))


(defn render!
  [{:keys [renderer camera n-samples calculate-beam-profile-pass render-target]}]
  (let [{:keys [update! scene]} calculate-beam-profile-pass
        width  (.-width render-target)
        height (.-height render-target)
        buffer (js/Uint8Array. (* 4 width height))]
    (re/with-reactive ::beam-profile
      (update!)
      (.setRenderTarget renderer render-target)
      (.render renderer scene camera)
      (.readRenderTargetPixels renderer render-target 0 0 width height buffer)
      (doseq [i (range 0 (* 4 n-samples) 4)]
        (let [r1 (aget buffer i)
              i1 (aget buffer (+ i 1))
              r2 (aget buffer (+ i 2))
              i2 (aget buffer (+ i 3))
              r  (dec (* 2 (/ (+ (* r1 255) (* r2 255 256)) 65535)))
              i  (dec (* 2 (/ (+ (* i1 255) (* i2 255 256)) 65535)))]
          ; vec2 v16;
          ; v16.x = (packed.r * 255.0) + (packed.g * 255.0) * 256.0;
          ; v16.y = (packed.b * 255.0) + (packed.a * 255.0) * 256.0;
          ; vec2 v = v16 / 65535.0;
          ; return v * 2.0 - 1.0;
          (js/console.log r))))))


(defn init! [canvas]
  (let [ctx           (.getContext canvas "2d")
        n-samples     512
        hidden-canvas (.createElement js/document "canvas")
        camera        (three/OrthographicCamera. -1 1 1 -1 0.1 10)
        renderer      (three/WebGLRenderer.
                       (clj->js {:canvas             hidden-canvas
                                 :alpha              true
                                 :premultipliedAlpha false
                                 :powerPreference    "high-performance"}))

        render-target (three/WebGLRenderTarget. n-samples 1)

        calculate-beam-profile-pass
        (three-common/create-pass
         (resource/inline "shaders/beam_profile.frag")
         [:u_elementsTexture :u_samplePoint :u_nElements
          :u_centerFrequency :u_pulseLength :u_time :u_soundSpeed
          :u_attenuationFactor])

        render-data {:canvas                      canvas
                     :ctx                         ctx
                     :renderer                    renderer
                     :camera                      camera
                     :n-samples                   n-samples
                     :render-target               render-target
                     :calculate-beam-profile-pass calculate-beam-profile-pass}]
    (.setSize renderer n-samples 1 false)
    (render! render-data)))

(defn main []
  [:div.control-canvas
   [:canvas
    {:replicant/on-mount
     (fn [{:replicant/keys [node]}]
       (init! node))
     :width  400
     :height 200}]])