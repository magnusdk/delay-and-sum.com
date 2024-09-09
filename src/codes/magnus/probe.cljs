(ns codes.magnus.probe
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]))


(defn focused-delay-model
  [element-position]
  (let [origin         (re/rget *state :probe :center)
        virtual-source (re/rget *state :virtual-source)
        sound-speed    (re/rget *state :sound-speed)
        dist-source-element (mat/distance virtual-source element-position)
        dist-source-origin  (mat/distance virtual-source origin)]
    (/ (- dist-source-element dist-source-origin) sound-speed)))

(defn deg2rad [rad]
  (* (/ rad 180) math/PI))

(defn rad2deg [rad]
  (* (/ rad math/PI) 180))

(defn angle [[x y]]
  (math/atan2 y x))

(defn intersect
  [[x1 z1] [x2 z2] angle [vs-x, vs-z]]
  (let [m1  (/ (- z2 z1) (- x2 x1))
        b1  (- z1 (* m1 x1))
        m2  (math/tan angle)
        b2  (- vs-z (* m2 vs-x))
        i-x (/ (- b2 b1) (- m1 m2))
        i-z (+ b1 (* m1 i-x))]
    [i-x i-z]))

(defn get-wave-origin
  [corner-1 corner-2 virtual-source]
  (let [angle-1    (angle (mat/sub corner-1 virtual-source))
        angle-2    (angle (mat/sub corner-2 virtual-source))
        mean-angle (/ (+ angle-1 angle-2) 2)]
    (intersect corner-1 corner-2 mean-angle virtual-source)))

(defn element-geometry
  []
  (let [{:keys [center
                n-elements
                array-width
                normal-azimuth
                element-width]} (re/rget *state :probe)
        virtual-source       (re/rget *state :virtual-source)
        delay-model          (re/rget *state :delay-model)
        [center-x center-y]  center
        normal-azimuth-rad   (deg2rad normal-azimuth)
        cos-normal-az        (math/cos normal-azimuth-rad)
        sin-normal-az        (math/sin normal-azimuth-rad)
        positions            (if (= 1 n-elements)
                                ; Special case when there is only one element: place it in the center of the array, regardless of the array width.
                               [center]
                                ; Else, spread them out across the width of the array.
                               (->> (range n-elements)
                                    (map (fn [i]
                                           (let [r (-> (/ i (dec n-elements))
                                                       (- 0.5)
                                                       (* array-width))
                                                 x (+ center-x (* r cos-normal-az))
                                                 y (+ center-y (* r sin-normal-az))]
                                             [x y])))))
        corner-1             (nth positions 0)
        corner-2             (nth positions (dec n-elements))
        corner-1-virtual-source-azimuth-rad (angle (mat/sub corner-1 virtual-source))
        corner-2-virtual-source-azimuth-rad (angle (mat/sub corner-2 virtual-source))
        wave-origin          (get-wave-origin corner-1 corner-2 virtual-source)]
    {:corner-1             corner-1
     :corner-2             corner-2
     :center               center
     :n-elements           n-elements
     :positions            positions
     :delays               (map focused-delay-model positions)
     :weights              (repeat n-elements 1)
     :normal-azimuth-rad   normal-azimuth-rad
     :width                element-width
     ; The angle from each corner to the virtual source
     :corner-1-virtual-source-azimuth-rad corner-1-virtual-source-azimuth-rad
     :corner-2-virtual-source-azimuth-rad corner-2-virtual-source-azimuth-rad
     :wave-origin          wave-origin}))

(defn update-from-corners!
  [corner-1 corner-2]
  (let [diff     (mat/sub corner-1 corner-2)
        mean     (mat/mul 0.5 (mat/add corner-1 corner-2))]
    (swap! *state assoc-in [:probe :center] mean)
    (swap! *state assoc-in [:probe :array-width] (mat/magnitude diff))
    (swap! *state assoc-in [:probe :normal-azimuth] (rad2deg (angle diff)))))