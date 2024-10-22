(ns codes.magnus.three.common
  (:require ["three" :as three]
            [codes.magnus.three.uniforms :as uniforms]
            [shadow.resource :as resource]))


(defn create-pass
  [fragment-shader uniforms]
  (let [uniforms (map uniforms/get-uniform uniforms)
        material (three/ShaderMaterial.
                  (clj->js {:vertexShader   (resource/inline "shaders/quad_gpgpu.vert")
                            :fragmentShader fragment-shader
                            :uniforms       (apply merge {} (map (juxt :name :initial) uniforms))
                            :glslVersion    three/GLSL3}))
        scene    (three/Scene.)
        geometry (three/Mesh. (three/PlaneGeometry. 2 2) material)]
    (.add scene geometry)
    {:scene    scene
     :material material
     :update! (fn [& {:as uniform-overrides}]
                (doseq [{:keys [name get-value update!]} uniforms]
                  (let [value (get uniform-overrides name (get-value))]
                    (update! material value)))
                (aset material "uniformsNeedUpdate" true)
                scene)}))

(defn set-texture!
  [material name render-target & {:keys [texture-index]}]
  (if texture-index
    (aset material "uniforms" name (clj->js {:value (aget render-target "textures" texture-index)}))
    (aset material "uniforms" name (clj->js {:value (.-texture render-target)})))
  (aset material "needsUpdate" true)
  (aset material "uniformsNeedUpdate" true))

(defn set-extra-uniform!
  [material name value]
  (aset material "uniforms" name (clj->js {:value value}))
  (aset material "uniformsNeedUpdate" true))

(aset three/ShaderChunk "common" (resource/inline "shaders/common.glsl"))
(aset three/ShaderChunk "packedElements" (resource/inline "shaders/packed_elements.glsl"))
(aset three/ShaderChunk "simulation" (resource/inline "shaders/simulation.glsl"))
