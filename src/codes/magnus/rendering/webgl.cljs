(ns codes.magnus.rendering.webgl
  (:require ["three" :as three]
            [shadow.resource :as resource]))


(defn create-shader
  [gl type source]
  (let [shader (.createShader gl type)]
    (.shaderSource gl shader source)
    (.compileShader gl shader)
    (when (not (.getShaderParameter gl shader (.-COMPILE_STATUS gl)))
      (throw (js/Error. (str "Could not create shader: " (.getShaderInfoLog gl shader))))
      (.deleteShader gl shader))
    shader))


(defn create-program
  [gl vertex-shader fragment-shader]
  (let [program (.createProgram gl)]
    (.attachShader gl program vertex-shader)
    (.attachShader gl program fragment-shader)
    (.linkProgram gl program)
    (when (not (.getProgramParameter gl program (.-LINK_STATUS gl)))
      (throw (js/Error. (str "Could not create program: " (.getProgramInfoLog gl program))))
      (.deleteProgram gl program))
    program))



(defn init-quad-vertices-buffer
  [gl attrib-loc]
  (let [positions       (js/Int8Array. [-1 -1, -1  1,  1 1   ; Upper left triangle
                                        1 -1, -1 -1,  1 1]) ; Lower right triangle
        buffer          (.createBuffer gl)
        vao             (.createVertexArray gl)
        ; vertexAttribPointer config
        size            2
        type            (.-BYTE gl)
        normalize       false
        stride          0
        offset          0]
    (.bindBuffer gl (.-ARRAY_BUFFER gl) buffer)
    (.bufferData gl (.-ARRAY_BUFFER gl) positions (.-STATIC_DRAW gl))
    (.bindVertexArray gl vao)
    (.enableVertexAttribArray gl attrib-loc)
    (.vertexAttribPointer gl attrib-loc size type normalize stride offset)
    {:vao vao :buffer buffer}))


(def quad-vertex-shader-src
  (resource/inline "shaders/quad_with_camera.vert"))


(defn create-fragment-shader-program
  [gl fragment-shader-source]
  (let [vertex-shader   (create-shader gl (.-VERTEX_SHADER gl) quad-vertex-shader-src)
        fragment-shader (create-shader gl (.-FRAGMENT_SHADER gl) fragment-shader-source)
        program         (create-program gl vertex-shader fragment-shader)
        attr-locs       {:vertex-position (.getAttribLocation gl program "a_position")}
        uniform-locs    {:camera-matrix (.getUniformLocation gl program "u_cameraMatrix")}
        buffers         {:vertices (init-quad-vertices-buffer gl (:vertex-position attr-locs))}]
    {:program program
     :attrib-locs attr-locs
     :uniform-locs uniform-locs
     :buffers buffers}))


(defn get-webgl-renderer-size
  [renderer]
  (let [target (three/Vector2.)]
    (.getSize renderer target)
    [(.-x target) (.-y target)]))