(ns codes.magnus.main-view.camera
  (:require ["three" :as three]
            [clojure.core.matrix :as mat]
            [codes.magnus.state :refer [*state]]
            [codes.magnus.reactive.core :as re]))


(def base-pixels-per-meter
  "The number of CSS pixels per simulation meter when the camera is not zoomed in or out."
  1000)



;; Scale and translation and their inversions
(defn translate-matrix
  [dx dy]
  [[1  0  0]
   [0  1  0]
   [dx dy 1]])

(defn scale-matrix
  ([scale]
   [[scale 0     0]
    [0     scale 0]
    [0     0     1]])
  ([[anchor-x anchor-y] scale]
   (-> (translate-matrix (- anchor-x) (- anchor-y))
       (mat/mmul (scale-matrix scale))
       (mat/mmul (translate-matrix (+ anchor-x) (+ anchor-y))))))

(defn invert-scale-translate-matrix [m]
  (let [[[sx _]
         [_  sy]
         [tx ty]] m
        sx-inv (/ sx)
        sy-inv (/ sy)
        tx-inv (* (- tx) sx-inv)
        ty-inv (* (- ty) sy-inv)]
    [[sx-inv 0      0]
     [0      sy-inv 0]
     [tx-inv ty-inv 1]]))



;; Common helper functions
(defn from-scale-and-pos
  [{scale :scale
    [tx ty] :pos}]
  [[scale 0     0]
   [0     scale 0]
   [tx    ty    1]])

(defn to-scale-and-pos
  [[[sx _  _]
    [_  sy _]
    [tx ty _]]]
  (assert (= sx sy) "Different scaling along x- and y-axes should not happen.")
  {:scale       sx
   :pos [tx ty]})

(defn to-three-js
  [[[sx _  _]
    [_  sy _]
    [tx ty _]]]
  (three/Matrix3.
   sx 0  0
   0  sy 0
   tx ty 1))

(defn to-context2d
  [[[sx _  _]
    [_  sy _]
    [tx ty _]]]
  [sx 0 0 sy tx ty])



;; Converting between coordinate systems
(defn screen-to-canvas-matrix
  "Return a matrix that goes from CSS pixels to context2D canvas pixels."
  [viewport-width viewport-height canvas-width canvas-height]
  (let [sx (/ canvas-width viewport-width)
        sy (/ canvas-height viewport-height)]
    [[sx 0  0]
     [0  sy 0]
     [0  0  1]]))

(defn screen-to-clip-matrix
  "Return a matrix that goes from CSS pixels to the clip space of the WebGL canvas. The 
   clip space has these values for each side of the canvas:
       Left:   -1  
       Right:   1
       Top:     1  
       Bottom: -1"
  [viewport-width viewport-height]
  (let [sx (/ 2 viewport-width)
        sy (/ 2 viewport-height)]
    [[sx 0        0]
     [0  (- sy)   0]
     [-1 (- 1 sy) 1]]))

(defn clip-to-world-matrix
  [viewport-width viewport-height]
  (let [camera-matrix (from-scale-and-pos (re/rget *state :camera))
        sx            (/ viewport-width base-pixels-per-meter)
        sy            (/ viewport-height base-pixels-per-meter)]
    (mat/mmul
     [[sx 0      0]
      [0  (- sy) 0]
      [0  sy     1]]
     camera-matrix)))


(defn screen-to-world-matrix [viewport-width viewport-height]
  (mat/mmul
   (screen-to-clip-matrix viewport-width viewport-height)
   (clip-to-world-matrix viewport-width viewport-height)))

(defn world-to-screen-matrix [viewport-width viewport-height]
  (invert-scale-translate-matrix (screen-to-world-matrix viewport-width viewport-height)))

(defn world-to-canvas-matrix [viewport-width viewport-height canvas-width canvas-height]
  (mat/mmul
   (world-to-screen-matrix viewport-width viewport-height)
   (screen-to-canvas-matrix viewport-width viewport-height canvas-width canvas-height)))

(defn transform-point [p m]
  (let [p (concat p [1]) ; Convert to homogeneous coordinates
        p (mat/mmul p m) ; Trnasform
        p (vec (take 2 p))]    ; Convert back
    p))

(defn transform-vec [v m]
  (let [v (mapv #(concat % [1]) v)
        v (mat/mmul v m)
        v (mapv #(vec (take 2 %)) v)]
    v))

(defn scale-vector [p m]
  (let [m (mat/mul m (translate-matrix 0 0))
        p (concat p [1]) ; Convert to homogeneous coordinates
        p (mat/mmul p m) ; Trnasform
        p (vec (take 2 p))]    ; Convert back
    p))



;; Camera matrix stuff
(defn camera-scale []
  (re/rget *state :camera :scale))

(defn camera-pos []
  (re/rget *state :camera :pos))

(defn canvas-viewport-scaling
  [viewport-width viewport-height canvas-width canvas-height]
  [(/ canvas-width viewport-width)
   (/ canvas-height viewport-height)])

(defn meters-per-pixel
  [viewport-width viewport-height]
  (let [screen-to-simulation-matrix (mat/mmul
                                     (screen-to-clip-matrix viewport-width viewport-height)
                                     (clip-to-world-matrix viewport-width viewport-height))]
    ; Return scaling in x (assumed to be the same in z)
    (mat/mget screen-to-simulation-matrix 0 0)))

(defn transform-camera! [m]
  (swap! *state update :camera #(to-scale-and-pos (mat/mmul (from-scale-and-pos %) m))))

(defn translate-camera! [dx dy]
  (transform-camera! (translate-matrix dx dy)))

(defn scale-camera! [anchor scaling-factor]
  (transform-camera! (scale-matrix anchor scaling-factor)))
