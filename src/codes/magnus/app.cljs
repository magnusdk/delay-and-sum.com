(ns codes.magnus.app
  (:require
   [codes.magnus.main-view.container :as main-view-container]
   [codes.magnus.timeline-view.timeline-canvas :as timeline-canvas]
   [reagent.dom :as rdom]))

(defn side-panel []
  [:div#side-panel
   [:p "Hello, World! (from side panel)"]])

(defn main []
  [:div.horizontalContainer
   [:div.verticalContainer
    [main-view-container/simulation-canvases-container]
    [timeline-canvas/component]]
   #_[side-panel]])

(defn init []
  (rdom/render main (.getElementById js/document "root")))
