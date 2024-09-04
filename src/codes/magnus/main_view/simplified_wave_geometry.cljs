(ns codes.magnus.main-view.simplified-wave-geometry
  (:require [codes.magnus.main-view.simplified-wave-geometry.focused :as focused]
            [codes.magnus.rendering.canvas :as canvas]))

(defn render-canvas!
  [*local-state *viewport-state]
  (let [{:keys [canvas-size ctx]} @*local-state
        [canvas-width canvas-height] canvas-size]
    (doto ctx
      (.clearRect 0 0 canvas-width canvas-height)
      (focused/draw-simplified-geometry!  *viewport-state))))


(def component
  (partial canvas/component canvas/init-context2d-component! render-canvas!))