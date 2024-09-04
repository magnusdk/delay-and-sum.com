(ns codes.magnus.fsm)

(defrecord FiniteStateMachine [definition current-state])

(defn handle!
  [*state key {:keys [type event]}]
  (let [{:keys [definition current-state]} (get @*state key)
        handler (or (get-in definition [current-state type])
                    (get-in definition [current-state ::any]))]
    (cond
      (nil? handler)     nil ; Do nothing
      (keyword? handler) (swap! *state assoc key (FiniteStateMachine. definition handler))
      :else              (when-let [target (:target (handler *state event))]
                           (swap! *state assoc key (FiniteStateMachine. definition target))))))
