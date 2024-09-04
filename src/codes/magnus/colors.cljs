(ns codes.magnus.colors
  (:require [thi.ng.color.core :as col]))

(defn with-alpha [{:keys [r g b]} a]
  (col/rgba r g b a))
(def light-pink (col/as-rgba (col/css "#FFC2D5")))
(def pink       (col/as-rgba (col/css "#FF195E")))
(def cyan       (col/as-rgba (col/css "#00F0FF")))
(def blue       (col/as-rgba (col/css "#0085FF")))
(def dark-blue  (col/as-rgba (col/css "#1D5199")))

