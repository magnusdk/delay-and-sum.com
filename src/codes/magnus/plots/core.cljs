(ns codes.magnus.plots.core
  (:require ["three" :as three]
            [clojure.core.matrix :as mat]
            [codes.magnus.colors :as colors]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]
            [codes.magnus.three.common :as three-common]
            [shadow.resource :as resource]
            [thi.ng.color.core :as col]))

(defn calculate!
  [{:keys [renderer camera passes render-targets]} render-target pass]
  (let [{:keys [update! scene]} (pass passes)]
    (update!)
    (.setRenderTarget renderer (render-target render-targets))
    (.render renderer scene camera)))

(defn postprocess-and-render-to-canvas!
  [{:keys [renderer camera passes render-targets]}]
  (let [{:keys [update! scene material]} (:postprocess passes)]
    (update!)
    (three-common/set-texture! material "t_previousRender" (:main render-targets))
    (.setRenderTarget renderer nil)
    (.render renderer scene camera)))

(defn copy-texture
  [{:keys [renderer camera passes render-targets]} from to]
  (let [{:keys [update! scene material]} (:copy-maximum-amplitude-pass passes)]
    (update!)
    (three-common/set-texture! material "t_data" (from render-targets))
    (.setRenderTarget renderer (to render-targets))
    (.render renderer scene camera)))

(defn init-maximum-amplitude-field! [render-data]
  (calculate! render-data :max-amplitude-current :beam-profile-stochasticly)
  (swap! *state assoc ::iteration 0))

(defn calculate-maximum-amplitude!
  [{:keys [renderer camera passes render-targets] :as render-data}]
  (when (< (re/rget *state ::iteration) 100)
    (calculate! render-data :max-amplitude-compare :beam-profile-stochasticly)
    (let [{:keys [update! scene material]} (:select-maximum-amplitude passes)]
      (update!)
      (three-common/set-texture! material "t_data1" (:max-amplitude-compare render-targets))
      (three-common/set-texture! material "t_data2" (:max-amplitude-current render-targets))
      (.setRenderTarget renderer (:main render-targets))
      (.render renderer scene camera))
    (copy-texture render-data :main :max-amplitude-current)
    (swap! *state update ::iteration inc))
  (postprocess-and-render-to-canvas! render-data))

(defn render! [render-data]
  (re/with-reactive ::check-maximum-amplitude?
    (if (re/rget *state :plot-use-maximum-amplitude?)
      (do (init-maximum-amplitude-field! render-data)
          (re/with-reactive ::calculate
            (calculate-maximum-amplitude! render-data)))
      (re/with-reactive ::calculate
        (calculate! render-data :main :beam-profile)
        (postprocess-and-render-to-canvas! render-data)))))

(defn rot90 [[x y]] [y (- x)])

(defn beam-profile-start-and-end-pos []
  (let [{:keys [time sound-speed plot-type beam-profile-sample-line-length]} @*state
        {:keys [wave-origin wave-direction t0]} (probe/element-geometry)
        beam-profile-direction (if (= plot-type "lateral-beam-profile")
                                 (rot90 wave-direction)
                                 wave-direction)
        dist   (* (- time t0) sound-speed)
        width  (/ beam-profile-sample-line-length 2)
        center (mat/add wave-origin (mat/mul wave-direction dist))]
    {:plot/left-most-pos (mat/add center (mat/mul beam-profile-direction width -1))
     :plot/right-most-pos (mat/add center (mat/mul beam-profile-direction width 1))}))

(defn add-event-handlers!
  [canvas]
  (doto canvas
    (.addEventListener
     "pointermove" (fn [e]
                     (let [{:keys [time sound-speed plot-type beam-profile-sample-line-length]} @*state
                           {:keys [wave-origin wave-direction t0]} (probe/element-geometry)
                           beam-profile-direction (if (= plot-type "lateral-beam-profile")
                                                    (rot90 wave-direction)
                                                    wave-direction)
                           ; Calculate the "uv-x", a number in [-1, 1], where -1 is the left-most of the canvas and 1 is the right-most of the canvas.
                           uv-x   (-> (.-offsetX e) (/ (.-offsetWidth canvas))
                                      (* 2) (- 1))
                           dist   (* (- time t0) sound-speed)
                           width  (/ beam-profile-sample-line-length 2)
                           center (mat/add wave-origin (mat/mul wave-direction dist))]
                       (swap! *state merge
                              (beam-profile-start-and-end-pos)
                              {:plot/hover-pos-uv-x     uv-x
                               :plot/hover-pos-offset-x (.-offsetX e)
                               :plot/hover-pos          (mat/add center (mat/mul beam-profile-direction width uv-x))}))))
    (.addEventListener
     "pointerleave" (fn [_]
                      (swap! *state dissoc
                             :plot/hover-pos-uv-x
                             :plot/hover-pos-offset-x
                             :plot/hover-pos
                             :plot/left-most-pos
                             :plot/right-most-pos)))))


(defn init-main-canvas! [canvas]
  (let [n-samples     1024
        camera        (three/OrthographicCamera. -1 1 1 -1 0.1 10)
        renderer      (three/WebGLRenderer.
                       (clj->js {:canvas             canvas
                                 :alpha              true
                                 :premultipliedAlpha false
                                 :powerPreference    "high-performance"}))

        beam-profile-pass
        (three-common/create-pass
         (resource/inline "shaders/calculate_beam_profile.frag")
         [:u_elementsTexture :u_nElements :u_centerFrequency :u_samplePoint
          :u_pulseLength :u_time :u_soundSpeed :u_attenuationFactor :u_waveOrigin :u_t0
          :u_waveDirection :u_lateralBeamProfile :u_beamProfileSampleLineLength])

        beam-profile-stochasticly-pass
        (three-common/create-pass
         (resource/inline "shaders/stochastic_time_beam_profile.frag")
         [:u_elementsTexture :u_nElements :u_centerFrequency :u_pulseLength :u_time
          :u_soundSpeed :u_attenuationFactor :u_waveOrigin :u_t0 :u_waveDirection
          :u_lateralBeamProfile :u_beamProfileSampleLineLength :u_seed])

        select-maximum-amplitude-pass
        (three-common/create-pass
         (resource/inline "shaders/select_maximum_amplitude.frag")
         [])

        copy-maximum-amplitude-pass
        (three-common/create-pass
         (resource/inline "shaders/copy_texture.frag")
         [])

        postprocess-pass
        (three-common/create-pass
         (resource/inline "shaders/postprocess_beam_profile.frag")
         [:u_plotMinimumDb :u_plotMaximumDb])

        render-data {:canvas         canvas
                     :ctx-2d         (.getContext canvas "2d")
                     :renderer       renderer
                     :camera         camera
                     :render-targets {:main                  (three/WebGLRenderTarget. 1 1)
                                      :max-amplitude-compare (three/WebGLRenderTarget. 1 1)
                                      :max-amplitude-current (three/WebGLRenderTarget. 1 1)}
                     :passes          {:beam-profile                beam-profile-pass
                                       :beam-profile-stochasticly   beam-profile-stochasticly-pass
                                       :select-maximum-amplitude    select-maximum-amplitude-pass
                                       :copy-maximum-amplitude-pass copy-maximum-amplitude-pass
                                       :postprocess                 postprocess-pass}}]
    (.setSize renderer n-samples 256 false)
    (doseq [render-target (vals (:render-targets render-data))]
      (.setSize render-target n-samples 256))
    (render! render-data)
    (add-event-handlers! canvas)))

(defn hovered-line []
  (let [x    (re/rget *state :plot/hover-pos-offset-x)
        uv-x (re/rget *state :plot/hover-pos-uv-x)]
    (when (and
           ; Only draw the line when hovering (when :plot/hover-pos-offset-x is not nil)
           x
           ; Don't draw the line outside of the plot bounds
           (<= -1 uv-x 1))
      [:div {:style {:pointer-events   "none"
                     :position         "absolute"
                     :left             x
                     :top              0
                     :height           "100%"
                     :width            "2px"
                     :background-color (:col (col/as-css colors/dark-blue))}}])))

(defn container []
  (when (not= "no-plot" (re/rget *state :plot-type))
    [:div.plot-container
     [:button.close-button
      {:on {:click #(swap! *state assoc :plot-type "no-plot")}}]
     [:h1 (case (re/rget *state :plot-type)
            "lateral-beam-profile" "Lateral Beam Profile"
            "axial-beam-profile" "Axial Beam Profile"
            nil)]
     [:canvas.fillSpace {:replicant/on-mount (fn [{:replicant/keys [node]}]
                                               (init-main-canvas! node))}]
     (hovered-line)]))