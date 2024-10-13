(ns codes.magnus.three.uniforms
  (:require ["three" :as three]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]))

(defn get-default-update-fn!
  ([uniform-name]
   (get-default-update-fn! uniform-name identity))
  ([uniform-name convert]
   (fn [material value]
     (aset material "uniforms" (name uniform-name) "value" (convert value)))))


; get-uniform takes the identifier/name of the uniform and returns a map of its:
; - Uniform-name
; - Initial value
; - A function for getting the latest, updated value
; - A function that takes the material and a value, and updates the material's uniform.
(defmulti get-uniform (fn [name] name))
(defmethod get-uniform :u_nElements [_]
  {:name      :u_nElements
   :initial   {:value nil}
   :get-value #(re/rget *state :probe :n-elements)
   :update!   (get-default-update-fn! :u_nElements)})

(defmethod get-uniform :u_centerFrequency [_]
  {:name      :u_centerFrequency
   :initial   {:value nil}
   :get-value #(re/rget *state :center-frequency)
   :update!   (get-default-update-fn! :u_centerFrequency)})

(defmethod get-uniform :u_pulseLength [_]
  {:name      :u_pulseLength
   :initial   {:value nil}
   :get-value #(re/rget *state :pulse-length)
   :update!   (get-default-update-fn! :u_pulseLength)})

(defmethod get-uniform :u_time [_]
  {:name      :u_time
   :initial   {:value nil}
   :get-value #(re/rget *state :time)
   :update!   (get-default-update-fn! :u_time)})

(defmethod get-uniform :u_soundSpeed [_]
  {:name      :u_soundSpeed
   :initial   {:value nil}
   :get-value #(re/rget *state :sound-speed)
   :update!   (get-default-update-fn! :u_soundSpeed)})

(defmethod get-uniform :u_samplePoint [_]
  {:name      :u_samplePoint
   :initial   {:value (three/Vector2.)}
   :get-value #(let [[x y] (re/rget *state :sample-point)] (three/Vector2. x y))
   :update!   (get-default-update-fn! :u_samplePoint)})

(defmethod get-uniform :u_attenuationFactor [_]
  {:name      :u_attenuationFactor
   :initial   {:value nil}
   :get-value #(re/rget *state :attenuation-factor)
   :update!   (get-default-update-fn! :u_attenuationFactor)})

(defmethod get-uniform :u_minimumTime [_]
  {:name      :u_minimumTime
   :initial   {:value nil}
   :get-value #(re/rget *state :minimum-time)
   :update!   (get-default-update-fn! :u_minimumTime)})

(defmethod get-uniform :u_maximumTime [_]
  {:name      :u_maximumTime
   :initial   {:value nil}
   :get-value #(re/rget *state :maximum-time)
   :update!   (get-default-update-fn! :u_maximumTime)})

(defmethod get-uniform :u_minimumDb [_]
  {:name      :u_minimumDb
   :initial   {:value nil}
   :get-value #(re/rget *state :minimum-db)
   :update!   (get-default-update-fn! :u_minimumDb)})

(defmethod get-uniform :u_maximumDb [_]
  {:name      :u_maximumDb
   :initial   {:value nil}
   :get-value #(re/rget *state :maximum-db)
   :update!   (get-default-update-fn! :u_maximumDb)})

(defmethod get-uniform :u_useDb [_]
  {:name      :u_useDb
   :initial   {:value true}
   :get-value #(re/rget *state :display-db?)
   :update!   (get-default-update-fn! :u_useDb)})

(defmethod get-uniform :u_displayMode [_]
  {:name      :u_displayMode
   :initial   {:value nil}
   :get-value #(case (re/rget *state :display-mode)
                 "phase"     0
                 "envelope"  1
                 "intensity" 2)
   :update!   (get-default-update-fn! :u_displayMode)})

(defmethod get-uniform :u_cameraMatrix [_]
  {:name      :u_cameraMatrix
   :initial   {:value (three/Matrix3.)}
   :get-value #(let [[viewport-width viewport-height] (re/rget *state :simulation-container/size)]
                 (camera/to-three-js (camera/clip-to-world-matrix viewport-width viewport-height)))
   :update!   (get-default-update-fn! :u_cameraMatrix)})

(defmethod get-uniform :u_elementsTexture [_]
  (let [data-texture (three/DataTexture.
                      (js/Float32Array. (* 4 512))  ; Mock data
                      512  ; Width is max number of elements (256) times 2.
                      1    ; Height is just 1
                      three/RGBAFormat  ; Each value holds 3 numbers
                      three/FloatType  ; Use floats instead of the default (uint8)
                      )]
    {:name      :u_elementsTexture
     :initial   {:value data-texture}
     :get-value #(let [{:keys [positions delays weights normal-azimuth-rad width n-elements]} (probe/element-geometry)
                       packed-elements (-> (for [[[x y] delay weight] (map vector positions delays weights)]
                                             [x y weight delay normal-azimuth-rad width nil nil])
                                           (flatten)
                                           (concat (repeat (* 8 (- 256 n-elements)) 0))
                                           (clj->js)
                                           (js/Float32Array.))]
                   (aset data-texture "image" "data" packed-elements)
                   (aset data-texture "needsUpdate" true)
                   data-texture)
     :update!   (get-default-update-fn! :u_elementsTexture)}))

(defmethod get-uniform :u_waveOrigin [_]
  {:name      :u_waveOrigin
   :initial   {:value (three/Vector2.)}
   :get-value #(let [{[x y] :wave-origin} (probe/element-geometry)]
                 (three/Vector2. x y))
   :update!   (get-default-update-fn! :u_waveOrigin)})

(defmethod get-uniform :u_t0 [_]
  {:name      :u_t0
   :initial   {:value nil}
   :get-value #(let [{:keys [t0]} (probe/element-geometry)] t0)
   :update!   (get-default-update-fn! :u_t0)})

(defmethod get-uniform :u_waveDirection [_]
  {:name      :u_waveDirection
   :initial   {:value (three/Vector2.)}
   :get-value #(let [{[x y] :wave-direction} (probe/element-geometry)]
                 (three/Vector2. x y))
   :update!   (get-default-update-fn! :u_waveDirection)})

(defmethod get-uniform :u_lateralBeamProfile [_]
  {:name      :u_lateralBeamProfile
   :initial   {:value nil}
   :get-value #(let [plot-type   (re/rget *state :plot-type)]
                 (= plot-type "lateral-beam-profile"))
   :update!   (get-default-update-fn! :u_lateralBeamProfile)})

(defmethod get-uniform :u_beamProfileSampleLineLength [_]
  {:name      :u_beamProfileSampleLineLength
   :initial   {:value true}
   :get-value #(re/rget *state :beam-profile-sample-line-length)
   :update!   (get-default-update-fn! :u_beamProfileSampleLineLength)})

(defmethod get-uniform :u_plotMinimumDb [_]
  {:name      :u_plotMinimumDb
   :initial   {:value true}
   :get-value #(re/rget *state :plot-minimum-db)
   :update!   (get-default-update-fn! :u_plotMinimumDb)})

(defmethod get-uniform :u_plotMaximumDb [_]
  {:name      :u_plotMaximumDb
   :initial   {:value true}
   :get-value #(re/rget *state :plot-maximum-db)
   :update!   (get-default-update-fn! :u_plotMaximumDb)})


(defmethod get-uniform :u_probeCenter [_]
  {:name      :u_probeCenter
   :initial   {:value (three/Vector2.)}
   :get-value #(let [[x y] (re/rget *state :probe :center)] (three/Vector2. x y))
   :update!   (get-default-update-fn! :u_probeCenter)})

(defmethod get-uniform :u_virtualSource [_]
  {:name      :u_virtualSource
   :initial   {:value (three/Vector2.)}
   :get-value #(let [[x y] (re/rget *state :virtual-source)] (three/Vector2. x y))
   :update!   (get-default-update-fn! :u_virtualSource)})

(defmethod get-uniform :u_seed [_]
  {:name      :u_seed
   :initial   {:value true}
   :get-value #(rand)
   :update!   (get-default-update-fn! :u_seed)})
