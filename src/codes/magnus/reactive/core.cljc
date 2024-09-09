#?(:clj  (ns codes.magnus.reactive.core)
   :cljs (ns codes.magnus.reactive.core
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
  (volatile! {}))

(defn maybe-run-reactive-fns!
  [reactive-fns]
  (doseq [[_ {:keys [update? update! *sub-reactive-fns]}] reactive-fns]
    (when (update?) (update!)) 
    (maybe-run-reactive-fns! @*sub-reactive-fns)))

(defn reactive [f]
  (let [*sub-reactive-fns (volatile! {})
        *state (volatile! ::first-time)
        rget!  (fn [*atom & path]
                 (let [value (get-in @*atom path)]
                   (vswap! *state update *atom assoc path value)
                   value))]
    {:*sub-reactive-fns *sub-reactive-fns
     :update? #(needs-update? *state)
     :update! (fn []
                (vreset! *state {})
                (with-redefs [*reactive-fns *sub-reactive-fns
                              rget          rget!]
                  (f)))}))

#?(:clj
   (defmacro with-reactive [id & body]
     `(let [reactive-f# (reactive (fn [] ~@body))]
        ((:update! reactive-f#))
        (vswap! *reactive-fns assoc ~id reactive-f#))))

#?(:cljs
   (defonce ^:private -main-loop
     (letfn [(body []
               (maybe-run-reactive-fns! @*reactive-fns)
               (.requestAnimationFrame js/window body))]
       (body))))
