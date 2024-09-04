(ns codes.magnus.main-view.simplified-wave-geometry.common)

(defn draw-polygon!
  [ctx points fill-style]
  (let [[x0 y0] (nth points 0)]
    (.save ctx)
    (set! (.-fillStyle ctx) fill-style)
    (doto ctx
      (.beginPath)
      (.moveTo x0 y0))
    (doseq [[x y] (drop 1 points)]
      (.lineTo ctx x y))
    (.fill ctx)
    (.restore ctx)))