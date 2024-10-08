(ns codes.magnus.main-view.interaction.core
  (:require [codes.magnus.main-view.interaction.desktop :as desktop]
            [codes.magnus.main-view.interaction.mobile :as mobile]))


(def touch-device?
  (or (exists? (.-ontouchstart js/window))
      (> (.-maxTouchPoints js/navigator) 0)))

(defn init! [element namespace get-pointer-pos support-camera-gestures]
  ; Note: this makes it so that devices that support both touch screen and mouse 
  ; pointer can only use touch screen for dragging stuff around.
  (if touch-device?
    (mobile/init! element namespace get-pointer-pos support-camera-gestures)
    (desktop/init! element namespace get-pointer-pos)))
