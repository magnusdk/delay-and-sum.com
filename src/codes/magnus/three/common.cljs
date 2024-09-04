(ns codes.magnus.three.common
  (:require ["three" :as three]
            [codes.magnus.db :refer [*db]]
            [codes.magnus.main-view.camera :as camera]
            [codes.magnus.probe :as probe]
            [reagent.core :as r]
            [shadow.resource :as resource]))

(set! *warn-on-infer* false)

(defn set-uniforms!
  [{:keys [material uniforms-setters]}]
  (let [uniforms (.-uniforms material)]
    (doseq [[uniform-name] (js->clj uniforms)]
      ((get uniforms-setters (keyword uniform-name)) material))))

(defn get-set-camera-matrix-uniform!-fn
  [*viewport-state]
  (fn [material]
    (let [[viewport-width viewport-height] @(r/cursor *viewport-state [:simulation/viewport-size])
          camera-matrix (camera/to-three-js (camera/clip-to-world-matrix viewport-width viewport-height))]
      (set! (.. material -uniforms -u_cameraMatrix -value) camera-matrix))))

(defn get-set-elements-uniform!-fn
  [elements-data-texture]
  (fn [material]
    (let [{:keys [positions delays weights normal-azimuth-rad width n-elements]} (probe/element-geometry)
          packed-elements (-> (for [[[x y] delay weight] (map vector positions delays weights)]
                                [x y weight delay normal-azimuth-rad width nil nil])
                              (flatten)
                              (concat (repeat (* 8 (- 256 n-elements)) 0))
                              (clj->js)
                              (js/Float32Array.))]
      (set! (.-image.data elements-data-texture) packed-elements)
      (set! (.-needsUpdate elements-data-texture) true)
      (set! (.. material -uniforms -u_elementsTexture -value) elements-data-texture))))

(defn get-set-uniform-from-db!-fn
  ([uniform-name db-path]
   (get-set-uniform-from-db!-fn uniform-name db-path identity))
  ([uniform-name db-path convert]
   (fn [material]
     (aset material "uniforms" (name uniform-name) "value" (convert @(r/cursor *db db-path))))))


(defn simulation-program
  [width height fragment-shader]
  (let [elements-dt        (three/DataTexture.
                            (js/Float32Array. (* 4 512))  ; Mock data
                            512  ; Width is max number of elements (256) times 2.
                            1    ; Height is just 1
                            three/RGBAFormat  ; Each value holds 3 numbers
                            three/FloatType  ; Use floats instead of the default (uint8)
                            )
        main-render-target (three/WebGLRenderTarget.
                            width height
                            (clj->js {:format three/RGFormat
                                      :type   three/FloatType}))
        material           (three/ShaderMaterial.
                            (clj->js {:vertexShader   (resource/inline "shaders/quad_gpgpu.vert")
                                      :fragmentShader fragment-shader
                                      :uniforms       {:u_elementsTexture  {:value elements-dt}
                                                       :u_samplePoint      {:value (three/Vector2.)}
                                                       :u_nElements        {:value nil}
                                                       :u_centerFrequency  {:value nil}
                                                       :u_pulseLength      {:value nil}
                                                       :u_time             {:value nil}
                                                       :u_soundSpeed       {:value nil}}}))
        geometry           (three/Mesh. (three/PlaneGeometry. 2 2) material)]
    {:uniforms-setters {:u_elementsTexture  (get-set-elements-uniform!-fn elements-dt)
                        :u_samplePoint      (get-set-uniform-from-db!-fn :u_samplePoint [:sample-point]
                                                                         #(three/Vector2. (nth % 0) (nth % 1)))
                        :u_nElements        (get-set-uniform-from-db!-fn :u_nElements [:probe :n-elements])
                        :u_centerFrequency  (get-set-uniform-from-db!-fn :u_centerFrequency [:center-frequency])
                        :u_pulseLength      (get-set-uniform-from-db!-fn :u_pulseLength [:pulse-length])
                        :u_time             (get-set-uniform-from-db!-fn :u_time [:time])
                        :u_soundSpeed       (get-set-uniform-from-db!-fn :u_soundSpeed [:sound-speed])}
     :geometry         [geometry]
     :textures         [elements-dt]
     :render-targets   {:main main-render-target}
     :material         material}))


(defn add-camera-matrix-uniform!
  [{:keys [material] :as program} *viewport-state]
  (aset material "uniforms" "u_cameraMatrix" #js{:value (three/Matrix3.)})
  (set! (.-uniformsNeedUpdate material) true)
  (assoc-in program [:uniforms-setters :u_cameraMatrix]
            (get-set-camera-matrix-uniform!-fn *viewport-state)))