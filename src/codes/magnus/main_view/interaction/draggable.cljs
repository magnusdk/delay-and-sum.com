(ns codes.magnus.main-view.interaction.draggable
  (:require [clojure.core.matrix :as mat]
            [codes.magnus.db :refer [*db]]
            [codes.magnus.fsm :as fsm]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.main-view.interaction.pointers :as pointers]
            [codes.magnus.probe :as probe]))

(def ^:private hover-distance 10)

(defmulti distance (fn [draggable point] (:type draggable)))

(defmethod distance :point [{:keys [pos]} point]
  (mat/distance pos point))

(defmethod distance :line [{[corner-1 corner-2] :corners} point]
  (let [ba (mat/sub corner-2 corner-1)
        pa (mat/sub point corner-1)
        h (mat/clamp (mat/div (mat/dot pa ba) (mat/dot ba ba)) 0 1)]
    (mat/magnitude (mat/sub pa (mat/mul h ba)))))

(defn get-draggable [*state]
  (let [{:keys [virtual-source sample-point]} @*db
        {:keys [center corner-1 corner-2]} (probe/element-geometry)
        {[viewport-width viewport-height] :simulation/viewport-size} @*state
        [virtual-source-screen
         sample-point-screen
         corner-1-screen
         corner-2-screen] (camera/transform-vec
                           [virtual-source sample-point corner-1 corner-2]
                           (camera/world-to-screen-matrix viewport-width viewport-height))]
    [{:name :virtual-source :type :point :pos virtual-source-screen :update! (fn [_ pos] (swap! *db assoc :virtual-source pos))}
     {:name :sample-point   :type :point :pos sample-point-screen   :update! (fn [_ pos] (swap! *db assoc :sample-point pos))}
     {:name :corner-1       :type :point :pos corner-1-screen       :update! (fn [_ pos] (probe/update-from-corners! corner-2 pos))}
     {:name :corner-2       :type :point :pos corner-2-screen       :update! (fn [_ pos] (probe/update-from-corners! pos corner-1))}
     {:name        :probe-body
      :type        :line
      :corners     [corner-1-screen corner-2-screen]
      :update-type :relative
      :update!     (fn [previous-pos current-pos]
                     (swap! *db update-in [:probe :center] #(mat/add % (mat/sub current-pos previous-pos))))
      :priority    1}]))

(defn closest-draggable [point draggables]
  (->> draggables
       (map #(assoc % :distance (distance % point)))
       (apply min-key (fn [{:keys [distance priority]}]
                        (+ distance (* (or priority 0) hover-distance))))))

(defn maybe-start-dragging!
  [*state event]
  (let [pointer-pos (:pointer-pos (.-detail event))
        {:keys [distance update!]
         :as draggable} (->> (get-draggable *state)
                             (closest-draggable (:screen pointer-pos)))]
    (when (< distance hover-distance)
      (swap! *state assoc
             ::dragging     draggable
             ::previous-pos pointer-pos
             ::current-pos  pointer-pos)
      (update! (:simulation pointer-pos) (:simulation pointer-pos))
      {:target :dragging})))

(defn maybe-hover!
  [*state event]
  (let [pointer-pos (get-in (.-detail event) [:pointer-pos :screen])
        {:keys [distance] :as draggable} (->> (get-draggable *state)
                                              (closest-draggable pointer-pos))]
    (if (< distance hover-distance)
      (do (swap! *state assoc ::hovering draggable)
          {:target :hovering})
      (do (swap! *state assoc ::hovering nil)
          {:target :idle}))))

(defn handle-drag!
  [*state event]
  (let [pointer-pos (:pointer-pos (.-detail event))
        {::keys [dragging snap-to-grid]} @*state
        space (if snap-to-grid :simulation-snap-to-grid :simulation)]
    (swap! *state assoc
           ::previous-pos (::current-pos @*state)
           ::current-pos  pointer-pos)
    ((:update! dragging) (get (::previous-pos @*state) space) (get (::current-pos @*state) space))))

(defn end-dragging!
  [*state event]
  (swap! *state assoc ::dragging nil)
  (maybe-hover! *state event))

(defn init-keyboard-event-handlers!
  [*state]
  (.addEventListener js/document "keydown" #(swap! *state assoc ::snap-to-grid (.-shiftKey %)))
  (.addEventListener js/document "keyup"   #(swap! *state assoc ::snap-to-grid (.-shiftKey %))))


(defn init!
  [*state]
  (swap! *state assoc ::fsm
         (fsm/FiniteStateMachine.
          {:idle     {::pointers/start-drag maybe-start-dragging!
                      ::pointers/hover      maybe-hover!}
           :hovering {::pointers/start-drag maybe-start-dragging!
                      ::pointers/hover      maybe-hover!}
           :dragging {::pointers/drag     handle-drag!
                      ::pointers/end-drag end-dragging!}}
          :idle))
  (let [{:keys [element]} @*state
        *registered-event-handlers (atom [])

        add-event-listener!
        (fn [element type]
          (let [handler #(fsm/handle! *state ::fsm {:type type :event %})]
            (swap! *registered-event-handlers conj [element type handler])
            (.addEventListener element type handler)))]

    (add-event-listener! element ::pointers/hover)
    (add-event-listener! element ::pointers/start-drag)
    (add-event-listener! element ::pointers/drag)
    (add-event-listener! element ::pointers/end-drag)
    (init-keyboard-event-handlers! *state)))
