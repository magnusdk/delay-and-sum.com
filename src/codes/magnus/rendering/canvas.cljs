(ns codes.magnus.rendering.canvas
  (:require [cljs.math :as math]
            [reagent.core :as r]
            [reagent.ratom :as ratom]))


(defn- get-optimal-canvas-size
  "Return the width and height of a canvas such that its ratio is as close as possible 
   to the viewport ratio, and such that the number of pixels is as close as possible to 
   `approx-n-pixels`."
  [approx-n-pixels viewport-width viewport-height]
  (let [viewport-ratio (/ viewport-width viewport-height)
        n-pixels-x     (math/round (math/sqrt (* approx-n-pixels viewport-ratio)))
        n-pixels-y     (math/round (math/sqrt (/ approx-n-pixels viewport-ratio)))]
    [n-pixels-x n-pixels-y]))


(defn- set-canvas-size!
  [*state *viewport-state]
  (let [[viewport-width viewport-height] @(r/cursor *viewport-state [:simulation/viewport-size])
        canvas-size (-> @(r/cursor *state [:n-pixels])
                        (get-optimal-canvas-size viewport-width viewport-height))]
    (swap! *state assoc :canvas-size canvas-size)))


(defn- canvas-updater-component
  "An invisible component that ensures that the canvas is rendered within the 
   requestAnimationFrame loop, and only when the parameters that the render function 
   uses has changed since the last time it was run."
  [render-canvas! *local-state *viewport-state]
  (fn []
    [:div {:style {:display "none"}}
     (when @(r/cursor *local-state [::initialized])
       ; Synchronize canvas size with `canvas-size` :-)
       (let [{:keys [canvas-size canvas]} @*local-state
             canvas-width  (.-width canvas)
             canvas-height (.-height canvas)]
         (when (not= canvas-size [canvas-width canvas-height])
           (set! (.-width canvas) (nth canvas-size 0))
           (set! (.-height canvas) (nth canvas-size 1))))
       ; Render the canvas. Because we wrap this in a component, it will only update 
       ; after parameters that it uses changes.
       (render-canvas! *local-state *viewport-state)
       nil)]))

(defn component [init! render! *viewport-state]
  (let [*local-state              (r/atom {:n-pixels (math/pow 2 20)})
        *set-canvas-size-reaction (r/reaction (set-canvas-size! *local-state *viewport-state))]
    (fn []
      (r/create-class
       {:component-did-mount
        (fn []
          (ratom/run! @*set-canvas-size-reaction)
          (init! *local-state *viewport-state)
          (swap! *local-state assoc ::initialized true))

        :reagent-render
        (fn []
          [:canvas.fillSpace
           {:ref #(swap! *local-state assoc :canvas %)}
           [canvas-updater-component render! *local-state *viewport-state]])}))))


(defn init-context2d-component! [*local-state _]
  (let [{:keys [canvas]} @*local-state
        ctx (.getContext canvas "2d")]
    (swap! *local-state assoc :ctx ctx)))
