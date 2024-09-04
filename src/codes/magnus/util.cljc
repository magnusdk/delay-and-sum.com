(ns codes.magnus.util
  (:require [shadow.resource :as resource]))

(defn get-pixels-per-meter []
  (let [temp-el (.createElement js/document "div")
        style (.-style temp-el)]
    (set! (.-width style) "1in")
    (set! (.-height style) "0")
    (set! (.-padding style) "0")
    (set! (.-visibility style) "hidden")
    (.appendChild (.-body js/document) temp-el)
    (let [pixels-per-inch (.-offsetWidth temp-el)]
      (.removeChild (.-body js/document) temp-el)
      (/ pixels-per-inch 0.0254))))


(defmacro read-file-at-compile-time [file-path]
  (let [file-content (resource/inline file-path)]
    `(do ~file-content)))