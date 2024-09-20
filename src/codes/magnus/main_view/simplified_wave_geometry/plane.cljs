(ns codes.magnus.main-view.simplified-wave-geometry.plane
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]
            [codes.magnus.colors :as colors]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.main-view.common :as common]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [thi.ng.color.core :as col]))

(defn angle [[x y]]
  (math/atan2 y x))

(defn draw-simplified-geometry!
  [ctx]
  (let [[viewport-width viewport-height] (re/rget *state :simulation-container/size)
        canvas                (.-canvas ctx)
        canvas-width          (.-width canvas)
        canvas-height         (.-height canvas)
        [scale-x scale-y]     (camera/canvas-viewport-scaling viewport-width viewport-height canvas-width canvas-height)
        aspect                (/ scale-x scale-y)
        view-to-canvas-matrix (camera/world-to-canvas-matrix
                               viewport-width viewport-height
                               canvas-width canvas-height)
        time                  (re/rget *state :time)
        sound-speed           (re/rget *state :sound-speed)
        virtual-source        (re/rget *state :virtual-source)

        {:keys [corner-1
                corner-2
                corner-1-virtual-source-azimuth-rad
                corner-2-virtual-source-azimuth-rad
                center
                wave-origin
                n-elements]} (probe/element-geometry)

        distance           (-> [(* time sound-speed) 0]
                               (camera/scale-vector view-to-canvas-matrix)
                               (mat/magnitude))

        [virtual-source corner-1 corner-2 wave-origin]
        (camera/transform-vec
         [virtual-source corner-1 corner-2 wave-origin]
         view-to-canvas-matrix)

        wave-dir              (mat/normalise (mat/sub virtual-source wave-origin))
        wave-dir-90           [(- (nth wave-dir 1)) (nth wave-dir 0)]
        viewport-diag-length  (mat/magnitude [viewport-width viewport-height])
        projected-length      (abs (apply + (mat/mul 0.5 (mat/sub corner-2 corner-1) wave-dir-90)))]
    (when (> n-elements 1)
      (common/draw-polygon!
       ctx [corner-1
            (mat/add corner-1 (mat/mul wave-dir viewport-diag-length 10))
            (mat/add corner-2 (mat/mul wave-dir viewport-diag-length 10))
            corner-2]
       (:col (col/as-css (colors/with-alpha colors/cyan 0.3)))))
    (let [[vs-x vs-y] virtual-source
          [beyond-vs-x beyond-vs-y] (-> virtual-source
                                        (mat/sub wave-origin)
                                        (mat/normalise)
                                        (mat/mul viewport-diag-length 10)
                                        (mat/add wave-origin))
          [wave-origin-x wave-origin-y] wave-origin

          [px py] (mat/add wave-origin (mat/mul wave-dir distance))]
      (.save ctx)
      (set! (.-lineWidth ctx) 5)
      (set! (.-lineCap ctx) "round")
      (doto ctx
        (.save ctx)
        (.setLineDash [10 20])
        (aset "strokeStyle" (:col (col/as-css colors/light-pink)))
        (.beginPath)
        (.moveTo wave-origin-x wave-origin-y)
        (.lineTo beyond-vs-x beyond-vs-y)
        (.stroke)
        (.restore ctx)

        (.beginPath)
        (aset "strokeStyle" (:col (col/as-css colors/light-pink)))
        (.moveTo px py)
        (.lineTo (+ px (* viewport-diag-length 10 (nth wave-dir-90 0))) (+ py (* viewport-diag-length 10 (nth wave-dir-90 1))))
        (.moveTo px py)
        (.lineTo (- px (* viewport-diag-length 10 (nth wave-dir-90 0))) (- py (* viewport-diag-length 10 (nth wave-dir-90 1))))
        (.stroke)

        (.beginPath)
        (aset "strokeStyle" (:col (col/as-css colors/pink)))
        (.moveTo px py)
        (.lineTo (+ px (* projected-length (nth wave-dir-90 0))) (+ py (* projected-length (nth wave-dir-90 1))))
        (.moveTo px py)
        (.lineTo (- px (* projected-length (nth wave-dir-90 0))) (- py (* projected-length (nth wave-dir-90 1))))
        (.stroke)))))