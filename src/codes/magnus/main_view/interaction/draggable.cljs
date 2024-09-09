(ns codes.magnus.main-view.interaction.draggable
  (:require [clojure.core.matrix :as mat]
            [codes.magnus.fsm :as fsm]
            [codes.magnus.main-view.interaction.pointers :as pointers]
            [codes.magnus.state :refer [*state]]
            [codes.magnus.util :as util]))

(defmulti distance (fn [draggable point] (:type draggable)))

(defmethod distance :point [{:keys [pos]} point]
  (mat/distance pos point))

(defmethod distance :line [{[corner-1 corner-2] :corners} point]
  (let [ba (mat/sub corner-2 corner-1)
        pa (mat/sub point corner-1)
        h (mat/clamp (mat/div (mat/dot pa ba) (mat/dot ba ba)) 0 1)]
    (mat/magnitude (mat/sub pa (mat/mul h ba)))))

(defn closest-draggable [point hover-distance draggables]
  (->> draggables
       (map #(assoc % :distance (distance % point)))
       (apply min-key (fn [{:keys [distance priority]}]
                        (+ distance (* (or priority 0) hover-distance))))))

(defn maybe-start-dragging! [{:keys [namespace event hover-distance get-draggable]}]
  (let [pointer-pos (:pointer-pos (.-detail event))
        {:keys [distance update!]
         :as draggable} (->> (get-draggable)
                             (closest-draggable (:screen pointer-pos) hover-distance))]
    (when (< distance hover-distance)
      (swap! *state update namespace assoc
             :dragging     draggable
             :previous-pos pointer-pos
             :current-pos  pointer-pos)
      (update! (:simulation pointer-pos) (:simulation pointer-pos))
      {:target :dragging})))

(defn maybe-hover! [{:keys [namespace event hover-distance get-draggable]}]
  (let [pointer-pos (get-in (.-detail event) [:pointer-pos :screen])
        {:keys [distance] :as draggable} (->> (get-draggable)
                                              (closest-draggable pointer-pos hover-distance))]
    (if (< distance hover-distance)
      (do (swap! *state update namespace assoc :hovering draggable)
          {:target :hovering})
      (do (swap! *state update namespace assoc :hovering nil)
          {:target :idle}))))

(defn handle-drag! [{:keys [namespace event]}]
  (let [pointer-pos (:pointer-pos (.-detail event))
        {:keys [dragging snap-to-grid]} (get @*state namespace)
        space (if snap-to-grid :simulation-snap-to-grid :simulation)]
    (swap! *state update namespace assoc
           :previous-pos (get-in @*state [namespace :current-pos])
           :current-pos  pointer-pos)
    ((:update! dragging)
     (get-in @*state [namespace :previous-pos space])
     (get-in @*state [namespace :current-pos space])
     snap-to-grid)))

(defn end-dragging! [{:keys [namespace] :as data}]
  (swap! *state update namespace assoc :dragging nil)
  (maybe-hover! data))

(defn init-keyboard-event-handlers! [namespace]
  (.addEventListener js/document "keydown" #(swap! *state update namespace assoc :snap-to-grid (.-shiftKey %)))
  (.addEventListener js/document "keyup"   #(swap! *state update namespace assoc :snap-to-grid (.-shiftKey %))))


(defn init! [element namespace get-draggable]
  (swap! *state assoc-in [namespace :fsm]
         (fsm/FiniteStateMachine.
          {:idle     {::pointers/start-drag maybe-start-dragging!
                      ::pointers/hover      maybe-hover!}
           :hovering {::pointers/start-drag maybe-start-dragging!
                      ::pointers/hover      maybe-hover!}
           :dragging {::pointers/drag     handle-drag!
                      ::pointers/end-drag end-dragging!}}
          :idle))
  (letfn [(add-event-listener! [element type]
            (let [handler #(fsm/handle! namespace
                                        {:type           type
                                         :element        element
                                         :hover-distance (* 10 util/device-pixel-ratio)
                                         :get-draggable  get-draggable
                                         :event          %})]
              (.addEventListener element type handler)))]
    (add-event-listener! element ::pointers/hover)
    (add-event-listener! element ::pointers/start-drag)
    (add-event-listener! element ::pointers/drag)
    (add-event-listener! element ::pointers/end-drag)
    (init-keyboard-event-handlers! namespace)))
