(ns codes.magnus.main-view.simplified-wave-geometry.diverging
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]
            [codes.magnus.colors :as colors]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.main-view.common :as common]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [thi.ng.color.core :as col]))

(defn get-side
  "Return 1 if v is in front of the line defined as going from v1 to v2, return -1 if 
   it is behind. Return 0 if it exactly on the line."
  [v1 v2 v]
  (let [[sx sy] (mat/sub v2 v1)
        [sx2 sy2] (mat/sub v v1)]
    (math/signum (- (* sx sy2) (* sy sx2)))))


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
        {:keys [corner-1
                corner-2
                corner-1-virtual-source-azimuth-rad
                corner-2-virtual-source-azimuth-rad
                center
                wave-origin
                n-elements]}  (probe/element-geometry)
        virtual-source        (re/rget *state :virtual-source)
        virtual-source-flipped (mat/sub (mat/mul 2 center) virtual-source)
        dir-corner-1          (mat/normalise (mat/sub corner-1 virtual-source-flipped))
        dir-corner-2          (mat/normalise (mat/sub corner-2 virtual-source-flipped))


        meters-traveled       (-> (* (- time) sound-speed)
                                  (- (mat/distance virtual-source-flipped center)))
        radius                (-> [meters-traveled 0]
                                  (camera/scale-vector view-to-canvas-matrix)
                                  (mat/magnitude))

        [virtual-source virtual-source-flipped corner-1 corner-2 wave-origin]
        (camera/transform-vec
         [virtual-source virtual-source-flipped corner-1 corner-2 wave-origin]
         view-to-canvas-matrix)

        source-corner-1-dir   (mat/normalise (mat/sub corner-1 virtual-source-flipped))
        source-corner-2-dir   (mat/normalise (mat/sub corner-2 virtual-source-flipped))
        viewport-diag-length  (mat/magnitude [viewport-width viewport-height])]
    (when (> n-elements 1)
      (common/draw-polygon!
       ctx [corner-1
            (mat/add corner-1 (mat/mul source-corner-1-dir viewport-diag-length 10)) 
            (mat/add corner-2 (mat/mul source-corner-2-dir viewport-diag-length 10))
            corner-2]
       (:col (col/as-css (colors/with-alpha colors/cyan 0.3)))))
    (let [[vs-flipped-x vs-flipped-y] virtual-source-flipped
          [beyond-vs-x beyond-vs-y] (-> virtual-source
                                        (mat/sub wave-origin)
                                        (mat/normalise)
                                        (mat/mul viewport-diag-length 10)
                                        (mat/add wave-origin))
          [wave-origin-x wave-origin-y] wave-origin
          [corner-1-azimuth-rad
           corner-2-azimuth-rad] (if (pos? meters-traveled)
                                   [corner-1-virtual-source-azimuth-rad corner-2-virtual-source-azimuth-rad]
                                   (mat/add math/PI [corner-1-virtual-source-azimuth-rad corner-2-virtual-source-azimuth-rad]))
          side (get-side corner-1 corner-2 virtual-source-flipped)
          [corner-1-azimuth-rad corner-2-azimuth-rad] (if (< side 0)
                                                        [corner-1-azimuth-rad corner-2-azimuth-rad]
                                                        [corner-2-azimuth-rad corner-1-azimuth-rad])]
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
        (.ellipse vs-flipped-x vs-flipped-y (* radius aspect) (/ radius aspect) 0 0 (* 2 math/PI))
        (.stroke))
      (when (> n-elements 1)
        (doto ctx
          (.beginPath)
          (aset "strokeStyle" (:col (col/as-css colors/pink)))
          (.arc vs-flipped-x vs-flipped-y radius corner-1-azimuth-rad corner-2-azimuth-rad)
          (.stroke)
          (.restore))))))