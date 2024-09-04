(ns codes.magnus.timeline-view.timeline-canvas
  (:require ["three" :as three]
            [codes.magnus.three.common :as common]
            [reagent.core :as r]
            [shadow.resource :as resource]))


(def fragment-shader
  "void main(){
  gl_fragColor(1.0, 0.0, 0.0, 1.0);
}")

(defn render!
  [*state])


(defn init!
  [*state]
  #_(let [{:keys [canvas canvas-size]} @*state
        [width height] canvas-size
        scene    (three/Scene.)
        camera   (three/OrthographicCamera. -1 1 1 -1 0.1 10)
        renderer (three/WebGLRenderer.
                  (clj->js {:canvas             canvas
                            :alpha              false
                            :premultipliedAlpha true
                            :precision          "lowp"
                            :powerPreference    "high-performance"}))
        {:keys [geometry] :as program} (common/simulation-program
                                        *viewport-state width height
                                        (resource/inline "shaders/main_simulation.frag"))]
    (.setSize renderer width height false)
    (doseq [g geometry] (.add scene g))
    (swap! *state assoc
           :program  (merge program
                            {:scene    scene
                             :camera   camera
                             :renderer renderer}))))

(defn canvas-updater-component
  "An invisible component that ensures that the canvas is rendered within the requestAnimationFrame loop."
  [*state]
  (fn []
    (when @(r/cursor *state [:program])
      (render! *state)
      nil)))

(defn component []
  (let [*state (r/atom {})]
    (fn []
      (r/create-class
       {:component-did-mount
        (fn [] (init! *state))

        :reagent-render
        (fn []
          [:div.timelineContainer
           [:canvas
            {:ref #(swap! *state assoc :canvas %)}
            [canvas-updater-component *state]]])}))))