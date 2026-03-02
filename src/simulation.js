/**
 * Simulation engine: probe math, camera matrices, and WebGL rendering pipeline.
 * Consolidates probe.cljs, camera.cljs, main_simulation.cljs, and uniforms.cljs.
 */

import {
  createRenderPass,
  createFramebuffer,
  createDataTexture,
  updateDataTexture,
  FULLSCREEN_VERT,
} from "./webgl.js";

import simulationFrag from "./shaders/simulation.frag";
import postprocessFrag from "./shaders/postprocess.frag";
import utilityFrag from "./shaders/utility.frag";
import timelineFrag from "./shaders/timeline.frag";
import beamProfileFrag from "./shaders/beam-profile.frag";

// ---- Vec2 / Mat3 Utilities ----

export function vec2(x, y) {
  return [x, y];
}
export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}
export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}
export function mul(a, s) {
  return Array.isArray(s) ? [a[0] * s[0], a[1] * s[1]] : [a[0] * s, a[1] * s];
}
export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}
export function len(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}
export function dist(a, b) {
  return len(sub(a, b));
}
export function normalize(v) {
  const l = len(v);
  return l === 0 ? [0, 0] : [v[0] / l, v[1] / l];
}
export function rot90(v) {
  return [v[1], -v[0]];
}

// Mat3 operations (column-major for WebGL: [m00,m10,m20, m01,m11,m21, m02,m12,m22])
// But our math uses row-major internally (matching ClojureScript's row-vector convention).
// The camera matrix is transposed before sending to WebGL.
// Internal format: [[a,b,c],[d,e,f],[g,h,i]] where p*M = [x,y,1]*M
// ClojureScript convention: point is a row vector, multiplied on the left.

/** Multiply two 3x3 matrices (row-major, row-vector convention). */
function mat3Mul(A, B) {
  return [
    [
      A[0][0] * B[0][0] + A[0][1] * B[1][0] + A[0][2] * B[2][0],
      A[0][0] * B[0][1] + A[0][1] * B[1][1] + A[0][2] * B[2][1],
      A[0][0] * B[0][2] + A[0][1] * B[1][2] + A[0][2] * B[2][2],
    ],
    [
      A[1][0] * B[0][0] + A[1][1] * B[1][0] + A[1][2] * B[2][0],
      A[1][0] * B[0][1] + A[1][1] * B[1][1] + A[1][2] * B[2][1],
      A[1][0] * B[0][2] + A[1][1] * B[1][2] + A[1][2] * B[2][2],
    ],
    [
      A[2][0] * B[0][0] + A[2][1] * B[1][0] + A[2][2] * B[2][0],
      A[2][0] * B[0][1] + A[2][1] * B[1][1] + A[2][2] * B[2][1],
      A[2][0] * B[0][2] + A[2][1] * B[1][2] + A[2][2] * B[2][2],
    ],
  ];
}

/** Invert a scale-translate matrix (fast path). */
function mat3InvertST(m) {
  const sx = 1 / m[0][0];
  const sy = 1 / m[1][1];
  return [
    [sx, 0, 0],
    [0, sy, 0],
    [-m[2][0] * sx, -m[2][1] * sy, 1],
  ];
}

/** Transform point [x,y] by 3x3 matrix (row-vector convention: [x,y,1] * M). */
export function transformPoint(p, m) {
  return [
    p[0] * m[0][0] + p[1] * m[1][0] + m[2][0],
    p[0] * m[0][1] + p[1] * m[1][1] + m[2][1],
  ];
}

/** Transform array of [x,y] points. */
export function transformPoints(pts, m) {
  return pts.map((p) => transformPoint(p, m));
}

/** Scale a vector (no translation). */
export function scaleVector(v, m) {
  return [v[0] * m[0][0] + v[1] * m[1][0], v[0] * m[0][1] + v[1] * m[1][1]];
}

/** Convert our row-major 3x3 to a Float32Array for WebGL (column-major for gl.uniformMatrix3fv). */
function mat3ToFloat32(m) {
  // Three.js Matrix3 constructor: (n11, n12, n13, n21, n22, n23, n31, n32, n33)
  // gl.uniformMatrix3fv expects column-major: [col0, col1, col2]
  // Our row-major: m[row][col]
  // Column-major flat: m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]
  return new Float32Array([
    m[0][0], m[1][0], m[2][0],
    m[0][1], m[1][1], m[2][1],
    m[0][2], m[1][2], m[2][2],
  ]);
}

// ---- Camera System ----

export const BASE_PIXELS_PER_METER = 1000;

function translateMatrix(dx, dy) {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [dx, dy, 1],
  ];
}

function scaleMatrix(s) {
  return [
    [s, 0, 0],
    [0, s, 0],
    [0, 0, 1],
  ];
}

function scaleAtMatrix(anchor, s) {
  return mat3Mul(
    mat3Mul(translateMatrix(-anchor[0], -anchor[1]), scaleMatrix(s)),
    translateMatrix(anchor[0], anchor[1])
  );
}

function fromScaleAndPos(camera) {
  return [
    [camera.scale, 0, 0],
    [0, camera.scale, 0],
    [camera.pos[0], camera.pos[1], 1],
  ];
}

function toScaleAndPos(m) {
  return { scale: m[0][0], pos: [m[2][0], m[2][1]] };
}

export function screenToClipMatrix(w, h) {
  const sx = 2 / w;
  const sy = 2 / h;
  return [
    [sx, 0, 0],
    [0, -sy, 0],
    [-1, 1 - sy, 1],
  ];
}

export function clipToWorldMatrix(w, h, camera) {
  const cm = fromScaleAndPos(camera);
  const sx = w / BASE_PIXELS_PER_METER;
  const sy = h / BASE_PIXELS_PER_METER;
  return mat3Mul(
    [
      [sx, 0, 0],
      [0, -sy, 0],
      [0, sy, 1],
    ],
    cm
  );
}

export function screenToWorldMatrix(w, h, camera) {
  return mat3Mul(screenToClipMatrix(w, h), clipToWorldMatrix(w, h, camera));
}

export function worldToScreenMatrix(w, h, camera) {
  return mat3InvertST(screenToWorldMatrix(w, h, camera));
}

export function screenToCanvasMatrix(vw, vh, cw, ch) {
  return [
    [cw / vw, 0, 0],
    [0, ch / vh, 0],
    [0, 0, 1],
  ];
}

export function worldToCanvasMatrix(vw, vh, cw, ch, camera) {
  return mat3Mul(
    worldToScreenMatrix(vw, vh, camera),
    screenToCanvasMatrix(vw, vh, cw, ch)
  );
}

export function metersPerPixel(w, h, camera) {
  const m = screenToWorldMatrix(w, h, camera);
  return m[0][0]; // x-scaling
}

export function canvasViewportScaling(vw, vh, cw, ch) {
  return [cw / vw, ch / vh];
}

/** Apply a transform matrix to the camera state. Returns new camera. */
export function transformCamera(camera, m) {
  return toScaleAndPos(mat3Mul(fromScaleAndPos(camera), m));
}

/** Zoom camera at an anchor point. Returns new camera. */
export function zoomCamera(camera, anchor, factor) {
  return transformCamera(camera, scaleAtMatrix(anchor, factor));
}

/** Pan camera by dx, dy. Returns new camera. */
export function panCamera(camera, dx, dy) {
  return transformCamera(camera, translateMatrix(dx, dy));
}

// ---- Probe Geometry ----

/** Tukey apodization window. */
export function tukey(n, r) {
  const window = [];
  for (let i = 1; i <= n; i++) {
    const x = i / (n + 1);
    let w;
    if (x < r / 2) {
      w = 0.5 * (1 + Math.cos((2 * Math.PI / r) * (x - r / 2)));
    } else if (x < 1 - r / 2) {
      w = 1;
    } else {
      w = 0.5 * (1 + Math.cos((2 * Math.PI / r) * (x - (1 - r / 2))));
    }
    window.push(w);
  }
  const mean = window.reduce((a, b) => a + b, 0) / n;
  return window.map((w) => w / mean);
}

function deg2rad(deg) {
  return (deg / 180) * Math.PI;
}

function rad2deg(rad) {
  return (rad / Math.PI) * 180;
}

function angle(v) {
  return Math.atan2(v[1], v[0]);
}

function intersect(p1, p2, ang, vs) {
  const m1 = (p2[1] - p1[1]) / (p2[0] - p1[0]);
  const b1 = p1[1] - m1 * p1[0];
  const m2 = Math.tan(ang);
  const b2 = vs[1] - m2 * vs[0];
  const ix = (b2 - b1) / (m1 - m2);
  const iz = b1 + m1 * ix;
  return [ix, iz];
}

function getWaveOrigin(corner1, corner2, virtualSource) {
  const a1 = angle(sub(corner1, virtualSource));
  const a2 = angle(sub(corner2, virtualSource));
  const meanAngle = (a1 + a2) / 2;
  return intersect(corner1, corner2, meanAngle, virtualSource);
}

function focusedDelay(elementPos, probeCenter, virtualSource, soundSpeedTx) {
  return (dist(virtualSource, elementPos) - dist(virtualSource, probeCenter)) / soundSpeedTx;
}

function planeDelay(elementPos, probeCenter, virtualSource, soundSpeedTx, normalAzimuthRad) {
  const focusingAngle = angle(sub(virtualSource, probeCenter)) - Math.PI / 2 - 2 * normalAzimuthRad;
  const d = sub(elementPos, probeCenter);
  return (d[0] * Math.sin(focusingAngle) + d[1] * Math.cos(focusingAngle)) / soundSpeedTx;
}

function divergingDelay(elementPos, probeCenter, virtualSource, soundSpeedTx) {
  const vsFlipped = sub(mul(probeCenter, 2), virtualSource);
  return (dist(vsFlipped, probeCenter) - dist(vsFlipped, elementPos)) / soundSpeedTx;
}

/**
 * Compute element geometry from state signals.
 * Returns positions, delays, weights, and all derived geometry.
 */
export function elementGeometry(state) {
  const { center, nElements, arrayWidth, normalAzimuth, elementWidth } = state.probe;
  const soundSpeed = state.soundSpeed;
  const virtualSource = state.virtualSource;
  const soundSpeedTx = state.soundSpeedTx;
  const normalAzimuthRad = deg2rad(normalAzimuth);
  const cosNa = Math.cos(normalAzimuthRad);
  const sinNa = Math.sin(normalAzimuthRad);

  // Element positions
  let positions;
  if (nElements === 1) {
    positions = [center];
  } else {
    positions = [];
    for (let i = 0; i < nElements; i++) {
      const r = (i / (nElements - 1) - 0.5) * arrayWidth;
      positions.push([center[0] + r * cosNa, center[1] + r * sinNa]);
    }
  }

  const corner1 = positions[0];
  const corner2 = positions[nElements - 1];
  const corner1VsAzimuth = angle(sub(corner1, virtualSource));
  const corner2VsAzimuth = angle(sub(corner2, virtualSource));

  const waveOrigin =
    state.delayModel === "plane"
      ? center
      : getWaveOrigin(corner1, corner2, virtualSource);

  // Delays
  const delays = positions.map((pos) => {
    switch (state.delayModel) {
      case "focused":
        return focusedDelay(pos, center, virtualSource, soundSpeedTx);
      case "plane":
        return planeDelay(pos, center, virtualSource, soundSpeedTx, normalAzimuthRad);
      case "diverging":
        return divergingDelay(pos, center, virtualSource, soundSpeedTx);
      default:
        return 0;
    }
  });

  // Weights (Tukey apodization)
  const weights = tukey(nElements, state.tukeyRoll);

  // Wave direction and t0
  const waveDirection = normalize(sub(virtualSource, waveOrigin));
  const t0 = (dist(virtualSource, center) - dist(virtualSource, waveOrigin)) / soundSpeed;

  return {
    positions,
    delays,
    weights,
    corner1,
    corner2,
    center,
    nElements,
    normalAzimuthRad,
    width: elementWidth,
    waveOrigin,
    waveDirection,
    t0,
    corner1VsAzimuth,
    corner2VsAzimuth,
  };
}

/** Pack element geometry into Float32Array for GPU texture (512x1 RGBA32F). */
export function packElementTexture(geometry) {
  const { positions, delays, weights, normalAzimuthRad, width, nElements } = geometry;
  const data = new Float32Array(512 * 4); // 512 texels, 4 floats each
  for (let i = 0; i < nElements; i++) {
    const offset = i * 8; // 2 texels per element = 8 floats
    data[offset + 0] = positions[i][0]; // pos.x
    data[offset + 1] = positions[i][1]; // pos.y
    data[offset + 2] = weights[i]; // weight
    data[offset + 3] = delays[i]; // delay
    data[offset + 4] = normalAzimuthRad; // normalAzimuthRad
    data[offset + 5] = width; // element width
    data[offset + 6] = 0;
    data[offset + 7] = 0;
  }
  return data;
}

/** Recalculate probe center, width, and azimuth from two corner positions. */
export function updateFromCorners(corner1, corner2) {
  const diff = sub(corner1, corner2);
  const mean = mul(add(corner1, corner2), 0.5);
  return {
    center: mean,
    arrayWidth: len(diff),
    normalAzimuth: rad2deg(angle(diff)),
  };
}

// ---- Optimal Canvas Size ----

export function getOptimalCanvasSize(approxNPixels, viewportWidth, viewportHeight) {
  const ratio = viewportWidth / viewportHeight;
  const w = Math.round(Math.sqrt(approxNPixels * ratio));
  const h = Math.round(Math.sqrt(approxNPixels / ratio));
  return [w, h];
}

// ---- Rendering Pipeline ----

/**
 * Initialize the main simulation rendering pipeline.
 * Returns render data object used by renderFrame().
 */
export function initMainSimulation(gl) {
  gl.getExtension("EXT_color_buffer_float");

  const passes = {
    calculateField: createRenderPass(gl, simulationFrag),
    postprocess: createRenderPass(gl, postprocessFrag),
    utility: createRenderPass(gl, utilityFrag),
  };

  const fbos = {
    main: createFramebuffer(gl, 1, 1, 2),
    maxAmplitudeMain: createFramebuffer(gl, 1, 1, 2),
    maxAmplitudeCompare: createFramebuffer(gl, 1, 1, 2),
  };

  const elementsTexture = createDataTexture(gl, new Float32Array(512 * 4), 512, 1);

  return { passes, fbos, elementsTexture, gl, iteration: 0, prevStateKey: null };
}

/** Build a string key from state values that affect stochastic accumulation. */
function stochasticStateKey(state) {
  return JSON.stringify([
    state.probe, state.virtualSource, state.centerFrequency, state.pulseLength,
    state.soundSpeed, state.soundSpeedTx, state.tukeyRoll, state.attenuationFactor,
    state.samplePoint, state.samplePointStrength, state.nPixels,
    state.simulationContainerSize, state.delayModel, state.camera,
  ]);
}

/** Resize all FBOs and the hidden canvas. */
export function resizeMainSimulation(renderData, width, height) {
  if (width <= 0 || height <= 0) return;
  const { fbos, gl } = renderData;
  fbos.main.resize(width, height);
  fbos.maxAmplitudeMain.resize(width, height);
  fbos.maxAmplitudeCompare.resize(width, height);
  renderData.width = width;
  renderData.height = height;
}

/** Build uniforms object from current state + geometry. */
function buildSimulationUniforms(state, geometry, viewportSize) {
  const [vw, vh] = viewportSize;
  const cam = clipToWorldMatrix(vw, vh, state.camera);
  return {
    u_cameraMatrix: mat3ToFloat32(cam),
    u_elementsTexture: null, // set separately
    u_nElements: geometry.nElements,
    u_centerFrequency: state.centerFrequency,
    u_pulseLength: state.pulseLength,
    u_time: state.time,
    u_soundSpeed: state.soundSpeed,
    u_samplePoint: state.samplePoint,
    u_samplePointStrength: state.samplePointStrength,
    u_attenuationFactor: state.attenuationFactor,
  };
}

/**
 * Render a single frame of the main simulation.
 * @param {object} renderData - from initMainSimulation
 * @param {object} state - current state values (not signals)
 * @param {HTMLCanvasElement} visibleCanvas - the canvas the user sees
 */
export function renderMainFrame(renderData, state, visibleCanvas) {
  const { passes, fbos, elementsTexture, gl } = renderData;
  const [vw, vh] = state.simulationContainerSize;
  if (!vw || !vh) return;

  // Compute canvas size
  const [cw, ch] = getOptimalCanvasSize(state.nPixels, vw, vh);
  if (cw <= 0 || ch <= 0) return;

  // Resize if needed
  if (renderData.width !== cw || renderData.height !== ch) {
    resizeMainSimulation(renderData, cw, ch);
    gl.canvas.width = cw;
    gl.canvas.height = ch;
  }

  // Update element texture
  const geometry = elementGeometry(state);
  const packedElements = packElementTexture(geometry);
  updateDataTexture(gl, elementsTexture, packedElements, 512, 1);

  const baseUniforms = buildSimulationUniforms(state, geometry, [vw, vh]);
  baseUniforms.u_elementsTexture = elementsTexture;

  if (state.maximumAmplitudeSimulation) {
    renderMaxAmplitudeMode(renderData, state, baseUniforms, geometry);
  } else {
    // Standard mode: calculate field → postprocess
    passes.calculateField.draw(
      { ...baseUniforms, u_stochastic: false },
      fbos.main
    );
    passes.postprocess.draw(
      {
        t_simulatedField: fbos.main.textures[0],
        t_maximumAmplitudeValues: fbos.main.textures[0],
        t_maximumAmplitudeTimes: fbos.main.textures[1],
        u_minimumDb: state.minimumDb,
        u_maximumDb: state.maximumDb,
        u_useDb: state.displayDb,
        u_displayMode: displayModeIndex(state.displayMode),
      },
      null // render to screen
    );
  }

  // Draw to visible canvas
  const ctx = visibleCanvas.getContext("2d");
  visibleCanvas.width = cw;
  visibleCanvas.height = ch;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(gl.canvas, 0, 0);
}

function renderMaxAmplitudeMode(renderData, state, baseUniforms, geometry) {
  const { passes, fbos, gl } = renderData;

  // Reset stochastic accumulation when simulation parameters change
  const key = stochasticStateKey(state);
  if (key !== renderData.prevStateKey) {
    renderData.prevStateKey = key;
    renderData.iteration = 0;
  }

  // Initialize if needed
  if (renderData.iteration === 0) {
    // Clear MRT
    passes.utility.draw({ u_operation: 0 }, fbos.maxAmplitudeMain);
  }

  // Run stochastic iteration
  if (renderData.iteration < 500) {
    // Stochastic pass → compare FBO
    passes.calculateField.draw(
      {
        ...baseUniforms,
        u_stochastic: true,
        u_seed: Math.random() * 1000,
        t_maximumAmplitudeValues: fbos.maxAmplitudeMain.textures[0],
        t_maximumAmplitudeTimes: fbos.maxAmplitudeMain.textures[1],
      },
      fbos.maxAmplitudeCompare
    );

    // Copy compare → main (MRT)
    passes.utility.draw(
      {
        u_operation: 2,
        t_values: fbos.maxAmplitudeCompare.textures[0],
        t_times: fbos.maxAmplitudeCompare.textures[1],
      },
      fbos.maxAmplitudeMain
    );

    renderData.iteration++;
  }

  // Postprocess
  const mode = displayModeIndex(state.displayMode);
  passes.postprocess.draw(
    {
      t_simulatedField: fbos.maxAmplitudeMain.textures[0],
      t_maximumAmplitudeValues: fbos.maxAmplitudeMain.textures[0],
      t_maximumAmplitudeTimes: fbos.maxAmplitudeMain.textures[1],
      u_minimumDb: state.minimumDb,
      u_maximumDb: state.maximumDb,
      u_useDb: state.displayDb,
      u_displayMode: mode,
    },
    null
  );
}

function displayModeIndex(mode) {
  switch (mode) {
    case "phase":
      return 0;
    case "envelope":
      return 1;
    case "intensity":
      return 2;
    case "time-delays":
      return 3;
    default:
      return 0;
  }
}

// ---- Timeline Rendering ----

const N_TIMELINE_SAMPLES = 2048;

export function initTimeline(gl) {
  gl.getExtension("EXT_color_buffer_float");

  const passes = {
    calculate: createRenderPass(gl, timelineFrag),
    postprocess: createRenderPass(gl, timelineFrag), // same shader, different uniforms
  };

  const fbo = createFramebuffer(gl, N_TIMELINE_SAMPLES, 1);
  const elementsTexture = createDataTexture(gl, new Float32Array(512 * 4), 512, 1);

  return { passes, fbo, elementsTexture, gl };
}

export function renderTimelineFrame(renderData, state, visibleCanvas) {
  const { passes, fbo, elementsTexture, gl } = renderData;
  const isProbe = state.sampleTimelineAt === "probe";

  // Canvas size
  const width = N_TIMELINE_SAMPLES;
  const height = isProbe ? state.probe.nElements : 256;
  const renderHeight = isProbe ? state.probe.nElements : 1;

  if (gl.canvas.width !== width || gl.canvas.height !== height) {
    gl.canvas.width = width;
    gl.canvas.height = height;
  }
  fbo.resize(width, renderHeight);

  // Update element texture
  const geometry = elementGeometry(state);
  const packedElements = packElementTexture(geometry);
  updateDataTexture(gl, elementsTexture, packedElements, 512, 1);

  const minimumTime = state.timelineOffset;
  const maximumTime = state.timelineOffset + state.timelineLength;

  // Shared simulation uniforms (no textures that could cause feedback loops)
  const simUniforms = {
    u_elementsTexture: elementsTexture,
    u_nElements: geometry.nElements,
    u_samplePoint: state.samplePoint,
    u_samplePointStrength: state.samplePointStrength,
    u_centerFrequency: state.centerFrequency,
    u_pulseLength: state.pulseLength,
    u_soundSpeed: state.soundSpeed,
    u_attenuationFactor: state.attenuationFactor,
    u_minimumTime: minimumTime,
    u_maximumTime: maximumTime,
    u_sampleMode: isProbe ? 0 : 1,
  };

  // Calculate field → render to FBO
  // Do NOT pass t_simulatedField here — it would create a feedback loop
  // (reading from fbo.textures[0] while writing to fbo).
  passes.calculate.draw(
    { ...simUniforms, u_postprocess: false },
    fbo
  );

  // Postprocess → render to screen, reading from FBO
  passes.postprocess.draw(
    {
      ...simUniforms,
      u_postprocess: true,
      u_displayMode: displayModeIndex(state.displayMode),
      u_minimumDb: state.minimumDb,
      u_maximumDb: state.maximumDb,
      u_useDb: state.displayDb,
      u_textureWidth: N_TIMELINE_SAMPLES,
      u_timelineGain: state.timelineGain,
      t_simulatedField: fbo.textures[0],
    },
    null // render to screen
  );

  // Draw to visible canvas
  visibleCanvas.width = width;
  visibleCanvas.height = height;
  const ctx = visibleCanvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(gl.canvas, 0, 0);
}

// ---- Beam Profile Rendering ----

export function initBeamProfile(gl) {
  gl.getExtension("EXT_color_buffer_float");

  const passes = {
    calculate: createRenderPass(gl, beamProfileFrag),
    selectMax: createRenderPass(gl, utilityFrag),
    copyTexture: createRenderPass(gl, utilityFrag),
    postprocess: createRenderPass(gl, beamProfileFrag),
  };

  const N_SAMPLES = 1024;
  const fbos = {
    main: createFramebuffer(gl, N_SAMPLES, 256),
    maxAmplitudeCurrent: createFramebuffer(gl, N_SAMPLES, 256),
    maxAmplitudeCompare: createFramebuffer(gl, N_SAMPLES, 256),
  };
  const elementsTexture = createDataTexture(gl, new Float32Array(512 * 4), 512, 1);

  return { passes, fbos, elementsTexture, gl, iteration: 0 };
}

export function renderBeamProfileFrame(renderData, state, canvas) {
  const { passes, fbos, elementsTexture, gl } = renderData;
  const geometry = elementGeometry(state);
  const packedElements = packElementTexture(geometry);
  updateDataTexture(gl, elementsTexture, packedElements, 512, 1);

  const isLateral = state.plotType === "lateral-beam-profile";
  const baseUniforms = {
    u_elementsTexture: elementsTexture,
    u_nElements: geometry.nElements,
    u_centerFrequency: state.centerFrequency,
    u_pulseLength: state.pulseLength,
    u_time: state.time,
    u_soundSpeed: state.soundSpeed,
    u_attenuationFactor: state.attenuationFactor,
    u_samplePoint: state.samplePoint,
    u_samplePointStrength: state.samplePointStrength,
    u_waveOrigin: geometry.waveOrigin,
    u_t0: geometry.t0,
    u_waveDirection: geometry.waveDirection,
    u_lateralBeamProfile: isLateral,
    u_beamProfileSampleLineLength: state.beamProfileSampleLineLength,
  };

  if (state.plotUseMaximumAmplitude) {
    // Stochastic beam profile
    if (renderData.iteration === 0) {
      passes.calculate.draw(
        { ...baseUniforms, u_stochastic: true, u_seed: Math.random() * 1000, u_postprocess: false },
        fbos.maxAmplitudeCurrent
      );
    }

    if (renderData.iteration < 200) {
      passes.calculate.draw(
        { ...baseUniforms, u_stochastic: true, u_seed: Math.random() * 1000, u_postprocess: false },
        fbos.maxAmplitudeCompare
      );

      passes.selectMax.draw(
        {
          u_operation: 3,
          t_data1: fbos.maxAmplitudeCompare.textures[0],
          t_data2: fbos.maxAmplitudeCurrent.textures[0],
        },
        fbos.main
      );

      passes.copyTexture.draw(
        { u_operation: 1, t_data: fbos.main.textures[0] },
        fbos.maxAmplitudeCurrent
      );

      renderData.iteration++;
    }

    // Postprocess
    passes.postprocess.draw(
      {
        ...baseUniforms,
        u_postprocess: true,
        u_stochastic: false,
        t_previousRender: fbos.maxAmplitudeCurrent.textures[0],
        u_plotMinimumDb: state.plotMinimumDb,
        u_plotMaximumDb: state.plotMaximumDb,
      },
      null
    );
  } else {
    // Deterministic beam profile
    passes.calculate.draw(
      { ...baseUniforms, u_stochastic: false, u_postprocess: false },
      fbos.main
    );

    passes.postprocess.draw(
      {
        ...baseUniforms,
        u_postprocess: true,
        u_stochastic: false,
        t_previousRender: fbos.main.textures[0],
        u_plotMinimumDb: state.plotMinimumDb,
        u_plotMaximumDb: state.plotMaximumDb,
      },
      null
    );
  }

  // Draw to visible canvas
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(gl.canvas, 0, 0);
}
