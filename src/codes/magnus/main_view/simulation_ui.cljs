(ns codes.magnus.main-view.simulation-ui
  (:require [cljs.math :as math]
            [codes.magnus.colors :as colors]
            [codes.magnus.db :refer [*db]]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.main-view.interaction.draggable :as draggable]
            [codes.magnus.probe :as probe]
            [codes.magnus.rendering.canvas :as canvas]
            [reagent.core :as r]
            [thi.ng.color.core :as col]))

(defn get-dot-size
  ([] 5)
  ([dragging? hovering?]
   (cond
     dragging? 7
     hovering? 6
     :else     (get-dot-size))))

(defn draw-dot!
  [ctx name color [x y] *viewport-state]
  (let [[viewport-width viewport-height] @(r/cursor *viewport-state [:simulation/viewport-size])
        dragging?     (= name @(r/cursor *viewport-state [::draggable/dragging :name]))
        hovering?     (= name @(r/cursor *viewport-state [::draggable/hovering :name]))
        canvas        (.-canvas ctx)
        canvas-width  (.-width canvas)
        canvas-height (.-height canvas)
        size          (get-dot-size dragging? hovering?)
        [scale-x scale-y] (camera/canvas-viewport-scaling viewport-width viewport-height canvas-width canvas-height)
        sx            (* size scale-x)
        sy            (* size scale-y)]
    (.save ctx)
    (set! (.-fillStyle ctx) (:col (col/as-css color)))
    (when hovering?
      (set! (.-shadowColor ctx) (:col (col/as-css (colors/with-alpha color 0.5))))
      (set! (.-shadowBlur ctx) 4)
      (set! (.-shadowOffsetY ctx) 3))
    (when dragging?
      (set! (.-fillStyle ctx) (:col (col/as-css (colors/with-alpha color 0.5))))
      (set! (.-shadowColor ctx) (:col (col/as-css (colors/with-alpha color 0.5))))
      (set! (.-shadowBlur ctx) 5)
      (set! (.-shadowOffsetY ctx) 4))
    (doto ctx
      (.beginPath)
      (.ellipse x y sx sy 0 0 (* 2 math/PI))
      (.fill))
    (.restore ctx)))

(defn draw-probe!
  [ctx *viewport-state]
  (let [[viewport-width viewport-height] @(r/cursor *viewport-state [:simulation/viewport-size])
        canvas                (.-canvas ctx)
        canvas-width          (.-width canvas)
        canvas-height         (.-height canvas)
        view-to-canvas-matrix (camera/world-to-canvas-matrix
                               viewport-width viewport-height
                               canvas-width canvas-height)
        {:keys [positions normal-azimuth-rad]} (probe/element-geometry)
        positions (camera/transform-vec positions view-to-canvas-matrix)
        [first-x first-y] (first positions)
        [last-x last-y] (last positions)
        [scale-x scale-y] (camera/canvas-viewport-scaling viewport-width viewport-height canvas-width canvas-height)]
    (.beginPath ctx)
    (set! (.-strokeStyle ctx) (:col (col/as-css colors/cyan)))
    (set! (.-lineWidth ctx) 2)
    (.moveTo ctx first-x first-y)
    (doseq [[x y] (rest positions)]
      (.lineTo ctx x y))
    (.stroke ctx)
    (draw-dot! ctx :corner-1 colors/dark-blue [first-x first-y] *viewport-state)
    (draw-dot! ctx :corner-2 colors/dark-blue [last-x last-y] *viewport-state)
    (doseq [[x y] positions]
      (set! (.-fillStyle ctx) (:col (col/as-css colors/dark-blue)))
      (doto ctx
        (.save)
        (.translate x y)
        (.rotate normal-azimuth-rad)
        (.beginPath)
        (.ellipse 0 0 (* 2 scale-x) (* 2 scale-y) 0 0 (* 2 math/PI))
        (.fill)
        (.restore ctx)))))

(defn render-canvas!
  [*local-state *viewport-state]
  (let [{:keys [canvas-size ctx]} @*local-state
        [canvas-width canvas-height] canvas-size
        [viewport-width viewport-height] @(r/cursor *viewport-state [:simulation/viewport-size])
        [virtual-source
         sample-point] (camera/transform-vec
                        [@(r/cursor *db [:virtual-source]) @(r/cursor *db [:sample-point])]
                        (camera/world-to-canvas-matrix viewport-width viewport-height canvas-width canvas-height))]
    (doto ctx
      (.clearRect 0 0 canvas-width canvas-height)
      (draw-probe! *viewport-state)
      (draw-dot! :virtual-source colors/pink virtual-source *viewport-state)
      (draw-dot! :sample-point colors/blue sample-point *viewport-state))))

(def component
  (partial canvas/component canvas/init-context2d-component! render-canvas!))
