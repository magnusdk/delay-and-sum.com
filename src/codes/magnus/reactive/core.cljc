#?(:clj  (ns codes.magnus.reactive.core)
   :cljs (ns codes.magnus.reactive.core
           (:require [codes.magnus.main-loop :as main-loop])
           (:require-macros [codes.magnus.reactive.core])))

(defn rget [*atom & path]
  (get-in @*atom path))

(defn- needs-update?
  [*state]
  (letfn [(changed-since-last-time? [[*atom accessed-values]]
            (->> accessed-values
                 (some (fn [[path value]]
                         (not= value (get-in @*atom path))))))]
    (or (= ::first-time @*state)
        (some changed-since-last-time? @*state))))

(defonce *reactive-fns
  (atom {}))

(defn maybe-run-reactive-fns!
  [reactive-fns]
  (doseq [[_ {:keys [update? update! *sub-reactive-fns]}] reactive-fns]
    (when (update?) (update!))
    (maybe-run-reactive-fns! @*sub-reactive-fns)))

(defn reactive [f]
  (let [*sub-reactive-fns (atom {})
        *state (atom ::first-time)
        rget!  (fn [*atom & path]
                 (let [value (get-in @*atom path)]
                   (swap! *state update *atom assoc path value)
                   value))]
    {:*sub-reactive-fns *sub-reactive-fns
     :update? #(needs-update? *state)
     :update! (fn []
                (reset! *state {})
                (with-redefs [*reactive-fns *sub-reactive-fns
                              rget          rget!]
                  (f)))}))

#?(:clj
   (defmacro with-reactive [id & body]
     `(let [reactive-f# (reactive (fn [] ~@body))]
        ((:update! reactive-f#))
        (swap! *reactive-fns assoc ~id reactive-f#))))

#?(:cljs
   (defn register! []
     (main-loop/register-handler!
      ::reactive-loop
      #(maybe-run-reactive-fns! @*reactive-fns))))
