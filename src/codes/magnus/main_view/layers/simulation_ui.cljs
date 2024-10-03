(ns codes.magnus.main-view.layers.simulation-ui
  (:require [cljs.math :as math]
            [codes.magnus.colors :as colors]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.main-view.interaction.draggable :as draggable]
            [codes.magnus.main-view.common :as common]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [thi.ng.color.core :as col]))

(defn get-dot-size
  ([] 5)
  ([dragging? hovering?]
   (cond
     dragging? 7
     hovering? 6
     :else     (get-dot-size))))

(defn draw-dot!
  [{:keys [canvas ctx]} name color [x y]]
  (let [[viewport-width viewport-height] (re/rget *state :simulation-container/size)
        dragging?     (= name (re/rget *state :simulation-container-draggable :dragging :name))
        hovering?     (= name (re/rget *state :simulation-container-draggable :hovering :name))
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
  [{:keys [canvas ctx] :as render-data}]
  (let [[viewport-width viewport-height] (re/rget *state :simulation-container/size)
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
    (draw-dot! render-data :corner-1 colors/dark-blue [first-x first-y])
    (draw-dot! render-data :corner-2 colors/dark-blue [last-x last-y])
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

(defn draw!
  [{:keys [canvas ctx] :as render-data}]
  (let [width  (.-width canvas)
        height (.-height canvas)
        [viewport-width viewport-height] (re/rget *state :simulation-container/size)
        [virtual-source
         sample-point] (camera/transform-vec
                        [(re/rget *state :virtual-source) (re/rget *state :sample-point)]
                        (camera/world-to-canvas-matrix viewport-width viewport-height width height))]
    (.clearRect ctx 0 0 width height)
    (draw-probe! render-data)
    (draw-dot! render-data :virtual-source colors/pink virtual-source)
    (draw-dot! render-data :sample-point colors/blue sample-point)
    (when-let [hover-pos (re/rget *state :plot/hover-pos)]
      (let [uv-x      (re/rget *state :plot/hover-pos-uv-x)
            hover-pos (camera/transform-point
                       hover-pos
                       (camera/world-to-canvas-matrix viewport-width viewport-height width height))]
        (when (<= -1 uv-x 1)
          (draw-dot! render-data :plot/hover-pos colors/dark-blue hover-pos))))
    (let [left-most-pos  (re/rget *state :plot/left-most-pos)
          right-most-pos (re/rget *state :plot/right-most-pos)]
      (when (and left-most-pos right-most-pos)
        (let [[left-most-pos
               right-most-pos] (camera/transform-vec
                                [left-most-pos right-most-pos]
                                (camera/world-to-canvas-matrix viewport-width viewport-height width height))]
          (doto ctx
            (.beginPath)
            (aset "strokeStyle" (:col (col/as-css colors/dark-blue)))
            (.moveTo (nth left-most-pos 0) (nth left-most-pos 1))
            (.lineTo (nth right-most-pos 0) (nth right-most-pos 1))
            (.stroke)))))))

(defn resize!
  [{:keys [canvas]}]
  (let [width  (.-width canvas)
        height (.-height canvas)
        [expected-width expected-height] (common/get-expected-size)]
    (when (not= [width height]
                [expected-width expected-height])
      (set! (.-width canvas) expected-width)
      (set! (.-height canvas) expected-height))
    ; Must have some with and height, else return false
    (> (* expected-width expected-height) 0)))


(defn render!
  [render-data]
  (re/with-reactive ::resize
    (when (resize! render-data)
      (re/with-reactive ::draw
        (draw! render-data)))))

(defn init! [canvas]
  (render! {:canvas canvas
            :ctx    (.getContext canvas "2d")}))
