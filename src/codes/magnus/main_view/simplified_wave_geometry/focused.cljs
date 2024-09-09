(ns codes.magnus.main-view.simplified-wave-geometry.focused
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]
            [codes.magnus.colors :as colors]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.main-view.common :as common]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [thi.ng.color.core :as col]))


(defn set-stroke-style!
  [ctx stroke-style]
  (set! (.-strokeStyle ctx) stroke-style))

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

        meters-traveled (-> (mat/distance virtual-source center)
                            (* (/ 1 sound-speed))
                            (- time)
                            (* sound-speed))
        radius          (-> (mat/sub center [meters-traveled 0])
                            (camera/scale-vector view-to-canvas-matrix)
                            (mat/magnitude))

        [virtual-source corner-1 corner-2 wave-origin]
        (camera/transform-vec
         [virtual-source corner-1 corner-2 wave-origin]
         view-to-canvas-matrix)

        source-corner-1-dir   (mat/normalise (mat/sub virtual-source corner-1))
        source-corner-2-dir   (mat/normalise (mat/sub virtual-source corner-2))
        viewport-diag-length  (mat/magnitude [viewport-width viewport-height])]
    (when (> n-elements 1)
      (common/draw-polygon!
       ctx [virtual-source corner-1 corner-2]
       (:col (col/as-css (colors/with-alpha colors/cyan 0.3))))
      (common/draw-polygon!
       ctx [virtual-source
            (mat/add virtual-source (mat/mul viewport-diag-length source-corner-1-dir))
            (mat/add virtual-source (mat/mul viewport-diag-length source-corner-2-dir))]
       (:col (col/as-css (colors/with-alpha colors/cyan 0.3)))))
    (let [[vs-x vs-y] virtual-source
          [wave-origin-x wave-origin-y] wave-origin
          [corner-1-azimuth-rad
           corner-2-azimuth-rad] (if (pos? meters-traveled)
                                   [corner-1-virtual-source-azimuth-rad corner-2-virtual-source-azimuth-rad]
                                   (mat/add math/PI [corner-1-virtual-source-azimuth-rad corner-2-virtual-source-azimuth-rad]))]
      (.save ctx)
      (set! (.-lineWidth ctx) 5)
      (set! (.-lineCap ctx) "round")
      (doto ctx
        (.save ctx)
        (.setLineDash [10 20])
        (set-stroke-style! (:col (col/as-css colors/light-pink)))
        (.beginPath)
        (.moveTo vs-x vs-y)
        (.lineTo wave-origin-x wave-origin-y)
        (.stroke)
        (.restore ctx))
      (doto ctx
        (.beginPath)
        (set-stroke-style! (:col (col/as-css colors/light-pink)))
        (.ellipse vs-x vs-y (* radius aspect) (/ radius aspect) 0 0 (* 2 math/PI))
        (.stroke))
      (when (> n-elements 1)
        (doto ctx
          (.beginPath)
          (set-stroke-style! (:col (col/as-css colors/pink)))
          (.arc vs-x vs-y radius corner-1-azimuth-rad corner-2-azimuth-rad)
          (.stroke)
          (.restore))))))