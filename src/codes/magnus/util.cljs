(ns codes.magnus.util)

(defonce device-pixel-ratio
  (.-devicePixelRatio js/window))