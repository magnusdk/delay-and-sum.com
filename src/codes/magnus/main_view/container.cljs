(ns codes.magnus.main-view.container
  (:require [codes.magnus.main-view.grid :as grid]
            [codes.magnus.main-view.interaction.draggable :as draggable]
            [codes.magnus.main-view.interaction.pointers :as pointers]
            [codes.magnus.main-view.main-simulation :as main-simulation]
            [codes.magnus.main-view.simplified-wave-geometry :as simplified-wave-geometry]
            [codes.magnus.main-view.simulation-ui :as simulation-ui]
            [reagent.core :as r]))

(defn debug-panel [*state]
  (fn []
    [:div {:style {:width "300px"
                   :position "absolute"
                   :top "5px"
                   :left "5px"
                   :background-color "white"
                   :box-shadow "0 2px 4px rgba(0, 0, 0, 0.25)"
                   :padding "10px"}}
     "::pointers/pointers-fsm :current-state: " @(r/cursor *state [::pointers/fsm :current-state])
     [:br]
     ":gestures/active-pointers: " @(r/cursor *state [::pointers/active-pointers])]))


(defn simulation-canvases-container []
  (let [*container-state (r/atom {:simulation/viewport-size [1 1]})]
    (fn []
      (r/create-class
       {:component-did-mount
        (fn []
          (let [{:keys [element]} @*container-state
                remove-gesture-event-listeners! (pointers/init-pointer-event-handlers! *container-state)]
            (draggable/init! *container-state)
            (swap! *container-state assoc ::remove-gesture-event-listeners! remove-gesture-event-listeners!)
            ; Handle window resizing. Also initialize the viewport size
            (letfn [(set-simulation-viewport-size! []
                      (swap! *container-state assoc :simulation/viewport-size
                             [(.-offsetWidth element) (.-offsetHeight element)]))]
              (.addEventListener js/window "resize" set-simulation-viewport-size!)
              (set-simulation-viewport-size!))))

        :component-will-unmount
        (fn [_]
          (when-let [{::keys [remove-gesture-event-listeners!]} @*container-state]
            (remove-gesture-event-listeners!)))

        :reagent-render
        (fn []
          (let [draggable-state @(r/cursor *container-state [::draggable/fsm :current-state])]
            [:div#simulationCanvasesContainer.stackedContainer
             {:ref   #(swap! *container-state assoc :element %)
              :style {:cursor (if (#{:hovering :dragging} draggable-state)
                                "pointer"
                                "auto")}}
             [simplified-wave-geometry/component *container-state]
             [main-simulation/component *container-state]
             [simulation-ui/component *container-state]
             [grid/component *container-state]
             #_[debug-panel *container-state]]))}))))
