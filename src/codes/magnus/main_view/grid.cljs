(ns codes.magnus.main-view.grid
  (:require [cljs.math :as math]
            [codes.magnus.main-view.camera :as camera]
            [reagent.core :as r]))

(defn magnitude-map
  "Convert magnitudes to ones that have a more common unit, like millimeters, 
   centimeter, meters, and kilometers."
  [mag-base-10]
  (cond
    (<= mag-base-10 -3) -3   ; From millimeter magnitude and below, present as mm
    (<= mag-base-10 -1) -2   ; Centimeter and decimeter magnitudes are presented as cm
    (<= mag-base-10 2)   0   ; Everything up to kilometer magnitude is presented as m
    :else                3)) ; From kilometer magnitude and beyond, present as km

(defn present-unit [mag-base-10]
  (case (magnitude-map mag-base-10)
    -3 "mm"
    -2 "cm"
    0  "m"
    3  "km"))

(defn present-tick-value [x mag-base-10]
  (let [presented-mag (magnitude-map mag-base-10)
        n-decimals    (max 0 (- presented-mag mag-base-10))
        rounded-x     (.toFixed (* x (math/pow 10 (- presented-mag))) n-decimals)
        rounded-x     (if (= 0 (js/parseFloat rounded-x)) 0 rounded-x)]
    (str
     rounded-x
     (present-unit presented-mag))))

(defn get-grid-css-background
  [origo-px-x origo-px-y cell-size-px alpha thickness]
  (str
   "linear-gradient(to right, rgba(0, 0, 0, " alpha ") " thickness "px, transparent " thickness "px) "
   origo-px-x "px 0 / " cell-size-px "px 1px, linear-gradient(to bottom, rgba(0, 0, 0, " alpha ") " thickness "px, transparent " thickness "px) 0 " origo-px-y "px / 1px " cell-size-px "px"))

(defn grid-tick [[x y] text key axis]
  [:span.grid-tick
   {:key key
    :class (case axis :x "x-tick" :y "y-tick")
    :style {:left x :top y}}
   text])

(defn component [*viewport-state]
  (fn []
    (let [[viewport-width viewport-height] @(r/cursor *viewport-state [:simulation/viewport-size])
          meters-per-px           (camera/meters-per-pixel viewport-width viewport-height)
          [origo-px-x origo-px-y] (camera/transform-point
                                   [0 0]
                                   (camera/world-to-screen-matrix viewport-width viewport-height))
          mag-base-10             (math/log10 meters-per-px)
          mag-base-10-snap        (math/ceil mag-base-10)
          approx-px-per-cell-mag  2 ; Approximately 10^2=100 px per cell
          cell-size-px            (math/pow 10 (+ approx-px-per-cell-mag (- mag-base-10) mag-base-10-snap))
          origo-px-x              (mod origo-px-x cell-size-px)
          origo-px-y              (mod origo-px-y cell-size-px)
          ; Offset the snap by -0.6 to get a smaller grid
          mag-base-10-snap-soft-grid (math/ceil (- mag-base-10 0.6))
          cell-size-px-soft-grid     (/ 100 (math/pow 10 (- mag-base-10 mag-base-10-snap-soft-grid)))
          ; Offset the snap by -0.6 to get a smaller grid
          mag-base-10-snap-ticks     (math/ceil (- mag-base-10 0.3))
          cell-size-px-ticks         (/ 100 (math/pow 10 (- mag-base-10 mag-base-10-snap-ticks)))
          ; Create two grids: one thick for the "main" grid, and one less visible for the "finer" offset grid
          p (max 0 (min 1 (/ (- cell-size-px-soft-grid 25) 75)))
          background-css          (str (get-grid-css-background origo-px-x origo-px-y cell-size-px (* 0.2 (- 1 p)) 1) ","
                                       (get-grid-css-background origo-px-x origo-px-y cell-size-px-soft-grid (* 0.2 p) 1))]

      ; Calculating tick label positions
      (when (and viewport-width viewport-height)
        (let [start-x (- origo-px-x (* (math/ceil (/ origo-px-x cell-size-px-ticks)) cell-size-px-ticks))
              start-y (- origo-px-y (* (math/ceil (/ origo-px-y cell-size-px-ticks)) cell-size-px-ticks))]
          [:div.fillSpace
           {:style {:background background-css :overflow "hidden"}}
           (doall
            (for [[i x-screen] (map-indexed vector (range start-x viewport-width cell-size-px-ticks))]
              (let [[x _] (camera/transform-point
                           [x-screen 0]
                           (camera/screen-to-world-matrix viewport-width viewport-height))]
                (grid-tick
                 [x-screen 0]
                 (present-tick-value x (+ mag-base-10-snap-ticks approx-px-per-cell-mag))
                 (str "y-axis-" i)
                 :x))))
           (doall
            (for [[i y-screen] (map-indexed vector (range start-y (+ viewport-height cell-size-px-ticks) cell-size-px-ticks))]
              (let [[_ y] (camera/transform-point
                           [0 y-screen]
                           (camera/screen-to-world-matrix viewport-width viewport-height))]
                (grid-tick
                 [0 y-screen]
                 (present-tick-value y (+ mag-base-10-snap-ticks approx-px-per-cell-mag))
                 (str "y-axis-" i)
                 :y))))])))))
