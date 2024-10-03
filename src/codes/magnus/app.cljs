(ns codes.magnus.app
  (:require [codes.magnus.main-view.container :as main-simulation-container]
            [codes.magnus.menu.core :as menu]
            [codes.magnus.plots.core :as plots]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [codes.magnus.timeline-view.timeline-canvas :as timeline-canvas]
            [replicant.dom :as r]))

(defonce webgl2-supported?
  (-> (.createElement js/document "canvas")
      (.getContext "webgl2")
      (boolean)))

(defn debug-panel
  "A panel with some arbitrary debug data that is only shown when debug is in the URL 
   query parameters."
  []
  (let [params (js/URLSearchParams. (.. js/window -location -search))]
    (when (.has params "debug")
      [:div {:style {:position "absolute"
                     :width    "100%"
                     :height   "100px"
                     :background-color "white"}}
       (str (re/rget *state :debug))])))

(defn main []
  (if-not webgl2-supported?
    [:div
     [:p "Sorry, your browser does not support WebGL 2 :/"]
     [:p "Please try another browser."]]
    [:div.fillSpace
     ; Main app UI
     [:div.horizontalContainer
      [:div.verticalContainer
       (main-simulation-container/container)
       (timeline-canvas/container)]
      (debug-panel)
      (menu/container)]
     ; Window for showing plots
     (plots/container)]))


(defn ^:dev/after-load render! []
  (re/with-reactive ::render!
    (r/render (.getElementById js/document "root") (main))))

(defn ^:export init! []
  (aset
   js/window "onerror"
   (fn [& args]
     (swap! *state assoc-in [:debug :error] args)))
  (re/register!)
  (render!))
