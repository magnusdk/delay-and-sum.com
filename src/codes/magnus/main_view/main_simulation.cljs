(ns codes.magnus.main-view.main-simulation
  (:require ["three" :as three]
            [codes.magnus.rendering.canvas :as canvas]
            [codes.magnus.rendering.webgl :as webgl]
            [codes.magnus.three.common :as common]
            [reagent.core :as r]
            [shadow.resource :as resource]))

(defn render-canvas! [*local-state *viewport-state]
  (let [canvas-size @(r/cursor *local-state [:canvas-size])
        {:keys [scene camera renderer render-targets] :as program} @(r/cursor *local-state [:program])]
    (when (not= (webgl/get-webgl-renderer-size renderer) canvas-size)
      (let [[width height] canvas-size]
        (.setSize renderer width height false)))
    (common/set-uniforms! program)

    ; Run simulation
    (.setRenderTarget renderer (:main render-targets))
    (.render renderer scene camera)

    ; Render to canvas
    (.setRenderTarget renderer nil)
    (.render renderer scene camera)))

(defn init!
  [*local-state *viewport-state]
  (let [{:keys [canvas canvas-size]} @*local-state
        [width height] canvas-size
        scene    (three/Scene.)
        camera   (three/OrthographicCamera. -1 1 1 -1 0.1 10)
        renderer (three/WebGLRenderer.
                  (clj->js {:canvas             canvas
                            :alpha              true
                            :premultipliedAlpha false
                            :precision          "lowp"
                            :powerPreference    "high-performance"}))
        {:keys [geometry] :as program} (-> (common/simulation-program
                                            width height
                                            (resource/inline "shaders/main_simulation.frag"))
                                           (common/add-camera-matrix-uniform! *viewport-state))]
    (.setSize renderer width height false)
    (doseq [g geometry] (.add scene g))
    (swap! *local-state assoc
           :program  (merge program
                            {:scene    scene
                             :camera   camera
                             :renderer renderer}))))

(def component
  (partial canvas/component init! render-canvas!))