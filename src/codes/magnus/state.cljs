(ns codes.magnus.state
  (:require [clojure.data :as data]
            [goog.crypt.base64 :as b64]
            [goog.functions :refer [debounce]]
            [goog.string.format]))

(def default-state
  {:camera {:scale 0.08
            :pos   [0 -0.01]}
   :n-pixels 1e6

   :virtual-source              [0 0.04]
   :sample-point                [-0.02 0.05]
   :force-current-time-at-focus false

   :center-frequency   3e6
   :pulse-length       2
   :sound-speed        1540
   :sound-speed-tx     1540
   :time               (/ 0.065 1540)
   :delay-model        "focused"
   :attenuation-factor 1
   :tukey-roll         0

   :display-mode                  "phase"  ; #{"phase" "envelope" "intensity"}
   :maximum-amplitude-simulation? false
   :minimum-time                  0
   :maximum-time                  1e-4
   :minimum-db                    -60
   :maximum-db                    0
   :display-db?                   true
   :show-simplified-geometry?     true
   :show-grid?                    true

   ; plot-type can be #{"no-plot" "lateral-beam-profile" "axial-beam-profile"}
   :plot-type                      "no-plot"
   :plot-use-maximum-amplitude?    true
   :beam-profile-sample-line-length 0.02  ; Meters

   :probe {:center         [0 0]
           :n-elements     256
           :array-width    2e-2
           :element-width  6e-5
           :normal-azimuth 0}})

(defn merge-diff [original diff]
  (cond
    (and (map? original) (map? diff))
    (reduce-kv
     (fn [m k v]
       (assoc m k (merge-diff (get original k) v)))
     original
     diff)

    (and (vector? original) (vector? diff))
    (mapv merge-diff original (concat diff (repeat nil)))

    (some? diff)
    diff

    :else
    original))


(defonce *state
  (let [params  (.-searchParams (js/URL. js/window.location.href))
        changes (some-> (.get params "state")
                        (b64/decodeString)
                        (js/JSON.parse)
                        (js->clj :keywordize-keys true))]
    (atom (merge-diff default-state changes))))

(defn reset-state! []
  (swap! *state merge default-state))


(defn dump-state-to-url! [changes]
  (let [data (some-> changes
                     (clj->js)
                     (js/JSON.stringify)
                     (b64/encodeString))
        url  (js/URL. js/window.location.href)]
    (if data
      (.set (.-searchParams url) "state" data)
      (.delete (.-searchParams url) "state"))
    (.replaceState js/window.history #js{} "" (.toString url))))

(def dump-state-to-url!-debounced
  (debounce dump-state-to-url! 100))

(defn- *state-change-watcher
  [_ _ _ new-state]
  (let [new-state (select-keys new-state (keys default-state))
        [_ changed _] (data/diff default-state new-state)]
    (dump-state-to-url!-debounced changed)))

(add-watch *state ::update-url *state-change-watcher)
