(ns codes.magnus.db
  (:require [clojure.core.matrix :as mat]
            [reagent.core :as r]
            [reagent.ratom :as ratom]))

(def *db
  (r/atom
   {:camera {:scale 0.08
             :pos   [0 -0.01]}

    :virtual-source   [0.03 0.05]
    :sample-point     [-0.02 0.05]

    :center-frequency            3e6
    :pulse-length                2
    :sound-speed                 1540
    :time                        0.000045
    :lock-wave-at-virtual-source false
    :delay-model                 :focused

    :probe {:center         [0 0]
            :n-elements     256
            :array-width    2e-2
            :element-width  6e-5
            :normal-azimuth 0}}))



; Some properties are reactive.
; NOTE: The website will freeze if we add 2-way bindings.
(let [*lock-wave-at-virtual-source-reaction
      (r/reaction (when @(r/cursor *db [:lock-wave-at-virtual-source])
                    (let [virtual-source @(r/cursor *db [:virtual-source])
                          sound-speed    @(r/cursor *db [:sound-speed])
                          origin         @(r/cursor *db [:probe :center])
                          time           (/ (mat/distance virtual-source origin) sound-speed)]
                      (swap! *db assoc :time time))))]

  (ratom/run! @*lock-wave-at-virtual-source-reaction))