(ns codes.magnus.state)

(def *state
  (atom
   {:camera {:scale 0.08
             :pos   [0 -0.01]}
    :n-pixels 1e6

    :virtual-source   [0 0.04]
    :sample-point     [-0.02 0.05]

    :center-frequency 3e6
    :pulse-length     2
    :sound-speed      1540
    :time             (/ 0.065 1540)
    :delay-model      :focused

    :minimum-time 0
    :maximum-time 1e-4
    :minimum-db   -60
    :maximum-db   0

    :probe {:center         [0 0]
            :n-elements     256
            :array-width    2e-2
            :element-width  6e-5
            :normal-azimuth 0}}))
