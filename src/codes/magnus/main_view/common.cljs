(ns codes.magnus.main-view.common
  (:require [cljs.math :as math]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]))

(defn- get-optimal-canvas-size
  "Return the width and height of a canvas such that its ratio is as close as possible 
   to the viewport ratio, and such that the number of pixels is as close as possible to 
   `approx-n-pixels`."
  [approx-n-pixels [viewport-width viewport-height]]
  (let [viewport-ratio (/ viewport-width viewport-height)
        n-pixels-x     (math/round (math/sqrt (* approx-n-pixels viewport-ratio)))
        n-pixels-y     (math/round (math/sqrt (/ approx-n-pixels viewport-ratio)))]
    [n-pixels-x n-pixels-y]))


(defn get-expected-size []
  (get-optimal-canvas-size
   (re/rget *state :n-pixels)
   (re/rget *state :simulation-container/size)))

(defn draw-polygon!
  [ctx-2d points fill-style]
  (let [[x0 y0] (nth points 0)]
    (.save ctx-2d)
    (set! (.-fillStyle ctx-2d) fill-style)
    (doto ctx-2d
      (.beginPath)
      (.moveTo x0 y0))
    (doseq [[x y] (drop 1 points)]
      (.lineTo ctx-2d x y))
    (.fill ctx-2d)
    (.restore ctx-2d)))