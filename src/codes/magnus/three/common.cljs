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
                            :uniforms       (apply merge {} (map :initial uniforms))}))
        scene    (three/Scene.)
        geometry (three/Mesh. (three/PlaneGeometry. 2 2) material)]
    (.add scene geometry)
    {:scene    scene
     :material material
     :update! (fn []
                (doseq [{update-uniform! :update!} uniforms]
                  (update-uniform! material))
                (aset material "uniformsNeedUpdate" true)
                scene)}))

(defn set-previous-render-texture!
  [material previous-render-target]
  (aset material "uniforms" "t_previousRender" (clj->js {:value (.-texture previous-render-target)}))
  (aset material "needsUpdate" true)
  (aset material "uniformsNeedUpdate" true))


(aset three/ShaderChunk "common" (resource/inline "shaders/common.glsl"))
(aset three/ShaderChunk "packedElements" (resource/inline "shaders/packed_elements.glsl"))
(aset three/ShaderChunk "simulation" (resource/inline "shaders/simulation.glsl"))
