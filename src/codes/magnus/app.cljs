(ns codes.magnus.app
  (:require [cljs.math :as math]
            [clojure.core.matrix :as mat]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.main-view.grid :as grid]
            [codes.magnus.main-view.interaction.core :as interaction]
            [codes.magnus.main-view.interaction.draggable :as draggable]
            [codes.magnus.main-view.main-simulation :as main-simulation]
            [codes.magnus.main-view.simplified-wave-geometry :as simplified-wave-geometry]
            [codes.magnus.main-view.simulation-ui :as simulation-ui]
            [codes.magnus.menu.core :as menu]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [codes.magnus.timeline-view.timeline-canvas :as timeline-canvas]
            [replicant.dom :as r]))

(defonce webgl2-supported?
  (-> (.createElement js/document "canvas")
      (.getContext "webgl2")
      (boolean)))


(defn mapv-round [v]
  (mapv math/round v))


(defn get-pos [_ pointer-pos-offset]
  (let [{[viewport-width viewport-height] :simulation-container/size} @*state
        pointer-pos-simulation (camera/transform-point
                                pointer-pos-offset
                                (camera/screen-to-world-matrix viewport-width viewport-height))
        meters-per-px           (camera/meters-per-pixel viewport-width viewport-height)
        mag-base-10             (math/log10 meters-per-px)
        mag-base-10-snap        (+ 2 (math/round (- mag-base-10 0.6)))
        simulation-snap-to-grid (-> pointer-pos-simulation
                                    (mat/mul (math/pow 10 (- mag-base-10-snap)))
                                    (mapv-round)
                                    (mat/mul (math/pow 10 mag-base-10-snap)))]
    {:offset     pointer-pos-offset
     :simulation pointer-pos-simulation
     :simulation-snap-to-grid simulation-snap-to-grid}))


(defn get-draggable []
  (let [{:keys [virtual-source sample-point]} @*state
        {:keys [corner-1 corner-2 n-elements center]} (probe/element-geometry)
        {[viewport-width viewport-height] :simulation-container/size} @*state
        [virtual-source-screen
         sample-point-screen
         corner-1-screen
         corner-2-screen
         center-screen] (camera/transform-vec
                         [virtual-source sample-point corner-1 corner-2 center]
                         (camera/world-to-screen-matrix viewport-width viewport-height))
        draggable [{:name    :virtual-source
                    :type    :point
                    :pos     virtual-source-screen
                    :update! (fn [_ pos _] (swap! *state assoc :virtual-source pos))}
                   {:name    :sample-point
                    :type    :point
                    :pos     sample-point-screen
                    :update! (fn [_ pos _] (swap! *state assoc :sample-point pos))}]]
    ; Handle special case where there is only 1 element. Then the user can drag the 
    ; center of the array as a dot.
    (if (= n-elements 1)
      (conj draggable {:name    :corner-1
                       :type    :point
                       :pos     center-screen
                       :update! (fn [_ pos _] (swap! *state assoc-in [:probe :center] pos))})


      (-> draggable
          (into [{:name :corner-1 :type :point :pos corner-1-screen :update! (fn [_ pos _] (probe/update-from-corners! corner-2 pos))}
                 {:name :corner-2 :type :point :pos corner-2-screen :update! (fn [_ pos _] (probe/update-from-corners! pos corner-1))}])
          (into (when (not= corner-1-screen corner-2-screen)
                  [{:name        :probe-body
                    :type        :line
                    :corners     [corner-1-screen corner-2-screen]
                    :update-type :relative
                    :update!     (fn [previous-pos current-pos snap-to-grid]
                                   (if snap-to-grid
                                     (swap! *state assoc-in [:probe :center] current-pos)
                                     (swap! *state update-in [:probe :center] #(mat/add % (mat/sub current-pos previous-pos)))))
                    :priority    1}]))))))


(defn init-container! [element]
  (letfn [(set-container-size! []
            (swap! *state assoc :simulation-container/size
                   [(.-offsetWidth element) (.-offsetHeight element)]))]
    (.addEventListener js/window "resize" set-container-size!)
    (set-container-size!)
    (interaction/init! element :simulation-container get-pos true)
    (draggable/init! element :simulation-container-draggable get-draggable)))


(defn simulation-container []
  [:div#simulationCanvasesContainer.stackedContainer
   {:style {:cursor (if (#{:hovering :dragging} (re/rget *state :simulation-container-draggable :fsm :current-state))
                      "pointer"
                      "default")}
    :replicant/on-mount (fn [{:replicant/keys [node]}]
                          (init-container! node))}
   [:canvas.fillSpace
    #:replicant{:key :background-ui
                :on-mount (fn [{:replicant/keys [node]}]
                            (simplified-wave-geometry/init! node))}]
   [:canvas.fillSpace
    #:replicant{:key :main-simulation
                :on-mount (fn [{:replicant/keys [node]}]
                            (main-simulation/init! node))}]
   [:canvas.fillSpace
    #:replicant{:key :simulation-ui
                :on-mount (fn [{:replicant/keys [node]}]
                            (simulation-ui/init! node))}]
   (grid/component)])


(defn main []
  (if-not webgl2-supported?
    [:div
     [:p "Sorry, your browser does not support WebGL 2 :/"]
     [:p "Please try another browser."]]
    [:div.horizontalContainer
     [:div.verticalContainer
      (simulation-container)
      (timeline-canvas/container)]
     #_[:div {:style {:position "absolute"
                      :width    "100%"
                      :height   "100px"
                      :background-color "white"}}
        (re/rget *state :simulation-container :fsm :current-state)
        (str (re/rget *state :debug))]
     (menu/main-component)]))


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
