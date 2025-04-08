(ns codes.magnus.menu.core
  (:require [cljs.core :as core]
            [clojure.core.matrix :as mat]
            [codes.magnus.colors :as colors]
            [codes.magnus.plots.core :as plots]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state reset-state!]]
            [thi.ng.color.core :as col]))

(set! *warn-on-infer* false)

(defn resize! [element]
  (aset element "size" (max 1 (aget element "value" "length"))))

(defn clamp [x {:keys [min max]}]
  (cond
    (and min max) (mat/clamp x min max)
    min           (core/max x min)
    max           (core/min x max)
    :else         x))

(defn wrap-around [x {:keys [wrap-around]}]
  (if wrap-around
    (cond
      (< x (- wrap-around)) (+ x (* 2 wrap-around))
      (> x wrap-around)     (- x (* 2 wrap-around))
      :else                 x)
    x))

(defn to-magnitude [x {:keys [magnitude]}]
  (if magnitude
    (* x magnitude)
    x))

(defn not-nan [x {:keys [min]}]
  (if (js/Number.isNaN x)
    (or min 0)
    x))

(defn to-state-format [x opts]
  (-> (js/parseFloat x)
      (wrap-around opts)
      (clamp opts)
      (to-magnitude opts)
      (not-nan opts)))

(defn from-magnitude [x {:keys [magnitude]}]
  (if magnitude
    (/ x magnitude)
    x))

(defn to-n-decimals [x {:keys [n-decimals]}]
  (if n-decimals
    (.toFixed x n-decimals)
    x))

(defn from-state-format [x opts]
  (-> x
      (from-magnitude opts)
      (clamp opts)
      (to-n-decimals opts)))

(defn update!
  [data-path event opts]
  (let [element   (.-target event)
        value     (to-state-format (.-value element) opts)
        new-value (from-state-format value opts)]
    (swap! *state assoc-in data-path value)
    (aset event "target" "value" new-value)
    (resize! element)))

(defn slider
  [label data-path & {:keys [units sensitivity on] :as opts}]
  (let [value            (from-state-format (apply re/rget *state data-path) opts)
        handle-key-down! (fn [event]
                           (let [key (.-key event)
                                 input-element (.querySelector (.-target event) "input")]
                             (when ((into #{"Enter"} "0123456789-") key)
                               (.select input-element))))]
    [:div.control.slidable-control
     {:replicant/on-mount (fn [{:replicant/keys [node]}]
                            (let [*local-state (atom {})]
                              (.addEventListener node "pointerdown"
                                                 (fn [e]
                                                   (when-not (-> (.-target e)
                                                                 (.-tagName)
                                                                 (.toLowerCase)
                                                                 (= "input"))
                                                     (swap! *state assoc ::dragging true)
                                                     (swap! *local-state assoc :dragging true))))
                              (.addEventListener js/document "pointerup"
                                                 (fn [e]
                                                   (swap! *state assoc ::dragging false)
                                                   (swap! *local-state assoc :dragging false)))
                              (.addEventListener js/document "pointermove"
                                                 (fn [e]
                                                   (when (:dragging @*local-state)
                                                     (let [delta   (* (.-movementX e) (or sensitivity 1))
                                                           element (.querySelector node "input")
                                                           value   (-> (.-value element)
                                                                       (js/parseFloat)
                                                                       (+ delta)
                                                                       (to-state-format opts))]
                                                       (swap! *state assoc-in data-path value)
                                                       (aset element "value" (from-state-format value opts))
                                                       (resize! element))))))

                            (when-let [callback (:pointerdown on)]
                              (.addEventListener node "pointerdown" callback))
                            (when-let [callback (:pointermove on)]
                              (.addEventListener node "pointermove" callback))
                            (when-let [callback (:pointerup on)]
                              (.addEventListener node "pointerup" callback))
                            (when-let [callback (:pointerleave on)]
                              (.addEventListener node "pointerleave" callback))

                            (.addEventListener
                             node "focus"
                             #(.addEventListener js/document "keydown" handle-key-down!))
                            (.addEventListener
                             node "blur"
                             #(.removeEventListener js/document "keydown" handle-key-down!)))
      :tabIndex 0}
     [:label label]
     [:input {:replicant/on-mount (fn [{:replicant/keys [node]}]
                                    (resize! node))
              :size (count (str value))
              :value value
              :on {:change (fn [event]
                             (update! data-path event opts))
                   :input  (fn [event]
                             (resize! (.-target event)))
                   :click  (fn [event]
                             (.select (.-target event)))}}]
     [:span.control-units units]]))

(defn select [data-path select-options]
  [:div.control-select;.is-updating-parameter
   [:select
    {:replicant/on-mount  (fn [{:replicant/keys [node]}]
                            (aset node "value" (apply re/rget *state data-path)))
     :replicant/on-update (fn [{:replicant/keys [node]}]
                            (aset node "value" (apply re/rget *state data-path)))
     :on                  {:change (fn [e]
                                     (swap! *state assoc-in data-path (aget e "target" "value")))}}
    (map (fn [[value label]]
           [:option {:value value} label])
         select-options)]])

(defn checkbox [data-path label]
  [:div.control
   [:label label]
   [:input {:on      {:change (fn [e] (swap! *state assoc-in data-path (aget e "target" "checked")))}
            :type    "checkbox"
            :checked (apply re/rget *state data-path)
            :replicant/on-update (fn [{:replicant/keys [node]}]
                                   (aset node "checked" (apply re/rget *state data-path)))}]
   [:span.control-units]])


(defn apodization-plot []
  [:div.control-canvas
   [:canvas
    {:replicant/on-mount
     (fn [{:replicant/keys [node]}]
       (let [width  (.-width node)
             height (.-height node)
             ctx    (.getContext node "2d")]
         (re/with-reactive ::apodization-plot
           (let [points (->> (probe/tukey width (re/rget *state :tukey-roll))
                             (map-indexed (fn [i w]
                                            [(* (/ i (dec width)) width)
                                             (* (- 2.2 w) (* 0.45 height))])))]
             (doto ctx
               (aset "fillStyle" (:col (col/as-css (colors/with-alpha colors/cyan 0.25))))
               (.clearRect 0 0 width height)
               (.rect 0 0 width height)
               (.fill)
               (.beginPath)
               (.moveTo -10 height)
               (.lineTo -10 (last (first points))))
             (doseq [[x y] points]
               (.lineTo ctx x y))
             (doto ctx
               (.lineTo (+ width 10) (last (last points)))
               (.lineTo (+ width 10) height)
               (aset "fillStyle" (:col (col/as-css colors/light-pink)))
               (.fill)
               (aset "lineWidth" 10)
               (aset "strokeStyle" "white")
               (.stroke)
               (aset "lineWidth" 4)
               (aset "strokeStyle" (:col (col/as-css colors/pink)))
               (.stroke))))))

     :width  400
     :height 100}]])


(defn header [title]
  [:h1 {:replicant/on-mount
        (fn [{:replicant/keys [node]}]
          (.addEventListener
           node "pointerdown"
           (fn [e]
             (let [class-list (aget node "parentNode" "classList")]
               (if (.contains class-list "menu-minimized")
                 (.remove class-list "menu-minimized")
                 (.add class-list "menu-minimized"))))))}
   title])

(defn button [title on-click]
  [:div.control
   [:button {:on {:click on-click}}
    title]])


(defn container []
  [:div.menu-container
   {:class [(when (re/rget *state ::menu-open?) :is-open)
            (when (re/rget *state ::dragging) :is-updating-parameter)]}
   [:div.menu-gradient-overlay]
   [:button.menu-button-mobile
    {:on {:click (fn [_] (swap! *state assoc ::menu-open? true))}}
    "Open menu"]
   [:div.menu
    #_[:div.menu-section
       (header "Plots")
       (beam-profile/main)]
    (when (re/rget *state ::menu-open?)
      (button "Close menu" #(swap! *state assoc ::menu-open? false)))

    [:div.menu-section
     (header "Array")
     (slider "No. of elements" [:probe :n-elements]
             :min 1
             :max 256)
     (slider "X" [:probe :center 0]
             :magnitude   1e-3
             :n-decimals  1
             :sensitivity 1e-1
             :units       "mm")
     (slider "Y" [:probe :center 1]
             :magnitude   1e-3
             :n-decimals  1
             :sensitivity 1e-1
             :units       "mm")
     (slider "Width" [:probe :array-width]
             :magnitude   1e-3
             :n-decimals  1
             :sensitivity 1e-1
             :min         0
             :units       "mm")
     (slider "Normal azimuth" [:probe :normal-azimuth]
             :n-decimals  1
             :wrap-around 180
             :units       "°")]

    [:div.menu-section
     (header "Transmitted wave")
     (select [:delay-model] [["focused"   "Focused wave"]
                             ["plane"     "Plane wave"]
                             ["diverging" "Diverging wave"]])
     (slider "Focus X" [:virtual-source 0]
             :magnitude   1e-3
             :n-decimals  1
             :sensitivity 1e-1
             :units       "mm")
     (slider "Focus Y" [:virtual-source 1]
             :magnitude   1e-3
             :n-decimals  1
             :sensitivity 1e-1
             :units       "mm")
     (slider "Center frequency" [:center-frequency]
             :magnitude   1e6
             :sensitivity 1e-2
             :n-decimals  2
             :min         1e-2
             :units       "MHz")
     (slider "Pulse length" [:pulse-length]
             :sensitivity 1e-1
             :n-decimals  2
             :min         1e-1
             :units       "λ")
     (slider "Attenuation" [:attenuation-factor]
             :min         0
             :sensitivity 1e-1
             :n-decimals  2)
     (slider "Sound speed" [:sound-speed]
             :min         1
             :units       "m/s")
     (slider "Sound speed assumed during focusing" [:sound-speed-tx]
             :min         1
             :units       "m/s")
     [:div.content
      [:h2 "Transmit apodization"]]
     (apodization-plot)
     (slider "Tukey roll" [:tukey-roll]
             :sensitivity 1e-2
             :n-decimals  2
             :min 0
             :max 1)]

    [:div.menu-section
     (header "Field display options")
     (let [display-mode-options (cond-> [["phase"       "Display phase"]
                                         ["envelope"    "Display envelope"]
                                         ["intensity"   "Display intensity"]]
                                  (re/rget *state :maximum-amplitude-simulation?)
                                  (conj ["time-delays" "Display time delays"]))]
       (select [:display-mode] display-mode-options))
     (slider "Minimum dB" [:minimum-db]
             :sensitivity 1e-1
             :n-decimals  1
             :units       "dB")
     (slider "Maximum dB" [:maximum-db]
             :sensitivity 1e-1
             :n-decimals  1
             :units       "dB")
     (checkbox [:maximum-amplitude-simulation?] "Show maximum amplitude")
     (checkbox [:display-db?] "Display in dB")
     (checkbox [:show-simplified-geometry?] "Show simplified geometry")
     (checkbox [:show-grid?] "Show grid")]

    [:div.menu-section
     (header "Timeline display options")
     (select [:sample-timeline-at] [["probe"        "Probe (render channel data)"]
                                    ["sample-point" "Sample point"]])
     (when (= (re/rget *state :sample-timeline-at) "sample-point")
       (slider "Timeline gain" [:timeline-gain]
               :sensitivity 1e-1
               :n-decimals  1))]

    [:div.menu-section
     (header "Plot")
     (select [:plot-type] [["no-plot"              "Don't display plot"]
                           ["lateral-beam-profile" "Lateral beam profile"]
                           ["axial-beam-profile"   "Axial beam profile"]])
     (when (not= (re/rget *state :plot-type) "no-plot")
       (list
        (slider "Beam profile sample line width" [:beam-profile-sample-line-length]
                :min         0
                :magnitude   1e-3
                :n-decimals  1
                :sensitivity 1e-1
                :units       "mm"
                :on          {:pointerdown  (fn [_] (swap! *state merge (plots/beam-profile-start-and-end-pos)))
                              :pointermove  (fn [_] (swap! *state merge (plots/beam-profile-start-and-end-pos)))
                              :pointerup    (fn [_] (swap! *state dissoc :plot/left-most-pos :plot/right-most-pos))
                              :pointerleave (fn [_] (swap! *state dissoc :plot/left-most-pos :plot/right-most-pos))})
        (checkbox [:plot-use-maximum-amplitude?] "Sample maximum amplitude")
        (slider "Minimum dB" [:plot-minimum-db]
                :sensitivity 1e-1
                :n-decimals  1
                :units       "dB")
        (slider "Maximum dB" [:plot-maximum-db]
                :sensitivity 1e-1
                :n-decimals  1
                :units       "dB")))]

    [:div.menu-section
     (header "General")
     (checkbox [:force-current-time-at-focus] "Force wavefront to be at focus point")
     (button "Reset all state" #(reset-state!))
     [:hr]
     [:div.content
      [:h2 "About"]
      [:p "Developed at and funded by NTNU. "
       [:a {:href "https://github.com/magnusdk/delay-and-sum.com"}
        "Find the source code on GitHub."]]
      [:p "This work was presented as a poster at IUS 2024. "
       [:a {:href "https://delay-and-sum.com/poster_delay_and_sum_com.pdf"}
        "Click here to view the poster as a PDF."]]
      [:p "If you find any bugs or have suggestions for improvements, "
       [:a {:href "https://github.com/magnusdk/delay-and-sum.com/issues/new"}
        "please create an issue on GitHub."]
       " Thank you! <3"]
      [:p "Otherwise, to get in touch: "
       [:a {:href "mailto:magnus.kvalevag@ntnu.no"}
        "magnus.kvalevag@ntnu.no"]]]
     [:div {:style {:height "120px"}}]]]])
