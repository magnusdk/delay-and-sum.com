(ns codes.magnus.geometry.line
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]))


(defn from-point-and-angle
  ([p angle] (from-point-and-angle p angle 1))
  ([p angle length]
   (let [d (mat/mul [(math/cos angle) (math/sin angle)] length)
         p2 (mat/add p d)]
     [p p2])))

(defn intersect [l1 l2]
  ; Implement me using clojure.core.matrix
  )
