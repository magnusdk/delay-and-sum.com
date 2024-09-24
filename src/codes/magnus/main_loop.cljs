(ns codes.magnus.main-loop)


(defonce *handlers
  (atom {}))

(defn register-handler! [key handler]
  (swap! *handlers assoc key handler))

(defonce main-loop
  (letfn [(body []
            (doseq [handler (vals @*handlers)]
              (handler))
            (.requestAnimationFrame js/window body))]
    (body)))