(ns codes.magnus.reactive.dependent-state
  (:require [codes.magnus.state :refer [*state]]
            [clojure.core.matrix :as mat]))


(defn changed-value? [old-state new-state & ks]
  (not= (get-in old-state ks) (get-in new-state ks)))

(defn need-update? [old-state new-state]
  (and (:force-current-time-at-focus new-state)
       (or (changed-value? old-state new-state :force-current-time-at-focus)
           (changed-value? old-state new-state :virtual-source)
           (changed-value? old-state new-state :sound-speed)
           (changed-value? old-state new-state :probe :center))))

(defn *state-change-watcher
  [_ _ old-state new-state]
  (when (need-update? old-state new-state)
    (let [{:keys [virtual-source probe sound-speed]} new-state
          {:keys [center]} probe
          time-when-wave-is-at-focus (/ (mat/distance virtual-source center) sound-speed)]
      (swap! *state assoc :time time-when-wave-is-at-focus))))

(defn init! []
  (add-watch *state ::force-current-time-at-focus *state-change-watcher))
