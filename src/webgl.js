export const FULLSCREEN_VERT = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_position;
}
`;

const quadVAOs = new WeakMap();

function getFullscreenQuadVAO(gl) {
  let vao = quadVAOs.get(gl);
  if (vao) return vao;

  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  quadVAOs.set(gl, vao);
  return vao;
}

export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed:\n${log}`);
  }
  return shader;
}

export function createProgram(gl, vertSrc, fragSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "a_position");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed:\n${log}`);
  }
  return program;
}

function buildUniformMap(gl, program) {
  const map = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    const name = info.name.replace(/\[0\]$/, "");
    map[name] = { location: gl.getUniformLocation(program, info.name), type: info.type };
  }
  return map;
}

function setUniforms(gl, uniformMap, uniforms) {
  let texUnit = 0;
  for (const name in uniforms) {
    const entry = uniformMap[name];
    if (!entry) continue;
    const { location, type } = entry;
    const val = uniforms[name];
    switch (type) {
      case gl.FLOAT:       gl.uniform1f(location, val); break;
      case gl.FLOAT_VEC2:  gl.uniform2fv(location, val); break;
      case gl.FLOAT_VEC3:  gl.uniform3fv(location, val); break;
      case gl.FLOAT_VEC4:  gl.uniform4fv(location, val); break;
      case gl.INT:  case gl.BOOL:
        gl.uniform1i(location, typeof val === "boolean" ? (val ? 1 : 0) : val); break;
      case gl.INT_VEC2: case gl.BOOL_VEC2: gl.uniform2iv(location, val); break;
      case gl.INT_VEC3: case gl.BOOL_VEC3: gl.uniform3iv(location, val); break;
      case gl.INT_VEC4: case gl.BOOL_VEC4: gl.uniform4iv(location, val); break;
      case gl.FLOAT_MAT2: gl.uniformMatrix2fv(location, false, val); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(location, false, val); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(location, false, val); break;
      case gl.SAMPLER_2D: case gl.INT_SAMPLER_2D: case gl.UNSIGNED_INT_SAMPLER_2D:
        gl.activeTexture(gl.TEXTURE0 + texUnit);
        gl.bindTexture(gl.TEXTURE_2D, val);
        gl.uniform1i(location, texUnit++);
        break;
      default:
        console.warn(`Unhandled uniform type ${type} for "${name}"`);
    }
  }
}

export function createRenderPass(gl, fragSrc, vertSrc) {
  const program = createProgram(gl, vertSrc || FULLSCREEN_VERT, fragSrc);
  const uniformMap = buildUniformMap(gl, program);
  const vao = getFullscreenQuadVAO(gl);

  return {
    program,
    draw(uniforms, fbo) {
      gl.useProgram(program);
      // Unbind textures to prevent feedback loops
      for (let i = 0; i < 8; i++) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      if (fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
        gl.viewport(0, 0, fbo.width, fbo.height);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      }
      if (uniforms) setUniforms(gl, uniformMap, uniforms);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
    },
  };
}

function setNearestClamp(gl) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function makeAttachments(gl, fbo, width, height, count, internalFormat, format, type) {
  const textures = [];
  const drawBuffers = [];
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  for (let i = 0; i < count; i++) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
    setNearestClamp(gl);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0);
    textures.push(tex);
    drawBuffers.push(gl.COLOR_ATTACHMENT0 + i);
  }
  gl.drawBuffers(drawBuffers);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return textures;
}

function createFBOInternal(gl, width, height, count, internalFormat, format, type) {
  const fbo = gl.createFramebuffer();
  const result = {
    fbo,
    textures: makeAttachments(gl, fbo, width, height, count, internalFormat, format, type),
    width,
    height,
    resize(w, h) {
      for (const t of result.textures) gl.deleteTexture(t);
      result.width = w;
      result.height = h;
      result.textures = makeAttachments(gl, fbo, w, h, count, internalFormat, format, type);
    },
  };
  return result;
}

export function createFramebuffer(gl, width, height, count = 1) {
  return createFBOInternal(gl, width, height, count, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
}

export function createDataTexture(gl, data, width, height) {
  gl.getExtension("EXT_color_buffer_float");
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
  setNearestClamp(gl);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

export function updateDataTexture(gl, texture, data, width, height) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

export function createHiddenGL() {
  const canvas = document.createElement("canvas");
  return canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
}
