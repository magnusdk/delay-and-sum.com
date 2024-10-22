(ns codes.magnus.fsm
  (:require [codes.magnus.state :refer [*state]]))

(defrecord FiniteStateMachine [definition current-state])


(defn handle!
  [namespace {:keys [type] :as data}]
  (let [{:keys [definition current-state]} (get-in @*state [namespace :fsm])
        handler (or (get-in definition [::any type])
                    (get-in definition [current-state type])
                    (get-in definition [current-state ::any]))
        data    (assoc data :namespace namespace)]
    (cond
      (nil? handler)     nil ; Do nothing
      (keyword? handler) (swap! *state assoc-in [namespace :fsm] (FiniteStateMachine. definition handler))
      :else              (when-let [target (:target (handler data))]
                           (swap! *state assoc-in [namespace :fsm] (FiniteStateMachine. definition target))))))
