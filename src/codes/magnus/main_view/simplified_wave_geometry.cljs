(ns codes.magnus.main-view.simplified-wave-geometry
  (:require [codes.magnus.main-view.common :as common]
            [codes.magnus.main-view.simplified-wave-geometry.diverging :as diverging]
            [codes.magnus.main-view.simplified-wave-geometry.focused :as focused]
            [codes.magnus.main-view.simplified-wave-geometry.plane :as plane]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]))

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

(defn draw! [{:keys [canvas ctx]}]
  (let [width  (.-width canvas)
        height (.-height canvas)]
    (.clearRect ctx 0 0 width height)
    (case (re/rget *state :delay-model)
      "focused"   (focused/draw-simplified-geometry! ctx)
      "plane"     (plane/draw-simplified-geometry! ctx)
      "diverging" (diverging/draw-simplified-geometry! ctx))))


(defn render!
  [render-data]
  (re/with-reactive ::resize
    (when (resize! render-data)
      (re/with-reactive ::draw
        (draw! render-data)))))

(defn init! [canvas]
  (render! {:canvas canvas
            :ctx    (.getContext canvas "2d")}))