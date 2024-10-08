(ns codes.magnus.three.uniforms
  (:require ["three" :as three]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.probe :as probe]
            [codes.magnus.reactive.core :as re]
            [codes.magnus.state :refer [*state]]))

(defn get-state-update!
  ([uniform-name db-path]
   (get-state-update! uniform-name db-path identity))
  ([uniform-name db-path convert]
   (fn [material]
     (aset material "uniforms" (name uniform-name) "value"
           (convert (apply re/rget *state db-path))))))


; get-uniform takes the identifier/name of the uniform and the *viewport-state of the 
; containing element of the render-target, and returns a map of its initial value and a 
; function that takes a material and the *viewport-state, and updates the uniform value 
; on that material.
(defmulti get-uniform (fn [name] name))

(defmethod get-uniform :u_nElements [_]
  {:initial {:u_nElements {:value nil}}
   :update! (get-state-update! :u_nElements [:probe :n-elements])})

(defmethod get-uniform :u_centerFrequency [_]
  {:initial {:u_centerFrequency {:value nil}}
   :update! (get-state-update! :u_centerFrequency [:center-frequency])})

(defmethod get-uniform :u_pulseLength [_]
  {:initial {:u_pulseLength {:value nil}}
   :update! (get-state-update! :u_pulseLength [:pulse-length])})

(defmethod get-uniform :u_time [_]
  {:initial {:u_time {:value nil}}
   :update! (get-state-update! :u_time [:time])})

(defmethod get-uniform :u_soundSpeed [_]
  {:initial {:u_soundSpeed {:value nil}}
   :update! (get-state-update! :u_soundSpeed [:sound-speed])})

(defmethod get-uniform :u_samplePoint [_]
  {:initial {:u_samplePoint (three/Vector2.)}
   :update! (get-state-update! :u_samplePoint [:sample-point] (fn [[x y]] (three/Vector2. x y)))})

(defmethod get-uniform :u_attenuationFactor [_]
  {:initial {:u_attenuationFactor {:value nil}}
   :update! (get-state-update! :u_attenuationFactor [:attenuation-factor])})

(defmethod get-uniform :u_minimumTime [_]
  {:initial {:u_minimumTime {:value nil}}
   :update! (get-state-update! :u_minimumTime [:minimum-time])})

(defmethod get-uniform :u_maximumTime [_]
  {:initial {:u_maximumTime {:value nil}}
   :update! (get-state-update! :u_maximumTime [:maximum-time])})

(defmethod get-uniform :u_minimumDb [_]
  {:initial {:u_minimumDb {:value nil}}
   :update! (get-state-update! :u_minimumDb [:minimum-db])})

(defmethod get-uniform :u_maximumDb [_]
  {:initial {:u_maximumDb {:value nil}}
   :update! (get-state-update! :u_maximumDb [:maximum-db])})

(defmethod get-uniform :u_useDb [_]
  {:initial {:u_useDb {:value true}}
   :update! (get-state-update! :u_useDb [:display-db?])})

(defmethod get-uniform :u_displayMode [_]
  {:initial {:u_displayMode {:value nil}}
   :update! (fn [material]
              (aset material "uniforms" "u_displayMode" "value"
                    (case (re/rget *state :display-mode)
                      "phase"     0
                      "envelope"  1
                      "intensity" 2)))})

(defmethod get-uniform :u_cameraMatrix [_]
  {:initial {:u_cameraMatrix (three/Matrix3.)}
   :update! (fn [material]
              (let [[viewport-width viewport-height] (re/rget *state :simulation-container/size)
                    camera-matrix (camera/to-three-js (camera/clip-to-world-matrix viewport-width viewport-height))]
                (aset material "uniforms" "u_cameraMatrix" "value" camera-matrix)))})

(defmethod get-uniform :u_elementsTexture [_]
  (let [data-texture (three/DataTexture.
                      (js/Float32Array. (* 4 512))  ; Mock data
                      512  ; Width is max number of elements (256) times 2.
                      1    ; Height is just 1
                      three/RGBAFormat  ; Each value holds 3 numbers
                      three/FloatType  ; Use floats instead of the default (uint8)
                      )]
    {:initial {:u_elementsTexture {:value data-texture}}
     :update! (fn [material]
                (let [{:keys [positions delays weights normal-azimuth-rad width n-elements]} (probe/element-geometry)
                      packed-elements (-> (for [[[x y] delay weight] (map vector positions delays weights)]
                                            [x y weight delay normal-azimuth-rad width nil nil])
                                          (flatten)
                                          (concat (repeat (* 8 (- 256 n-elements)) 0))
                                          (clj->js)
                                          (js/Float32Array.))]
                  (aset data-texture "image" "data" packed-elements)
                  (aset data-texture "needsUpdate" true)
                  (aset material "uniforms" "u_elementsTexture" "value" data-texture)))}))

(defmethod get-uniform :u_waveOrigin [_]
  {:initial {:u_waveOrigin {:value (three/Vector2.)}}
   :update! (fn [material]
              (let [{[x y] :wave-origin} (probe/element-geometry)]
                (aset material "uniforms" "u_waveOrigin" "value" (three/Vector2. x y))))})

(defmethod get-uniform :u_t0 [_]
  {:initial {:u_t0 {:value nil}}
   :update! (fn [material]
              (let [{:keys [t0]} (probe/element-geometry)]
                (aset material "uniforms" "u_t0" "value" t0)))})

(defmethod get-uniform :u_waveDirection [_]
  {:initial {:u_waveDirection {:value (three/Vector2.)}}
   :update! (fn [material]
              (let [{[x y] :wave-direction} (probe/element-geometry)]
                (aset material "uniforms" "u_waveDirection" "value" (three/Vector2. x y))))})


(defmethod get-uniform :u_lateralBeamProfile [_]
  {:initial {:u_lateralBeamProfile {:value nil}}
   :update! (fn [material]
              (let [plot-type   (re/rget *state :plot-type)
                    is-lateral? (= plot-type "lateral-beam-profile")]
                (aset material "uniforms" "u_lateralBeamProfile" "value" is-lateral?)))})


(defmethod get-uniform :u_beamProfileSampleLineLength [_]
  {:initial {:u_beamProfileSampleLineLength {:value true}}
   :update! (get-state-update! :u_beamProfileSampleLineLength [:beam-profile-sample-line-length])})
