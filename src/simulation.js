import {
  createRenderPass,
  createFramebuffer,
  createDataTexture,
  updateDataTexture,
} from "./webgl.js";

import simulationFrag from "./shaders/simulation.frag";
import postprocessFrag from "./shaders/postprocess.frag";
import utilityFrag from "./shaders/utility.frag";
import timelineFrag from "./shaders/timeline.frag";
import beamProfileFrag from "./shaders/beam-profile.frag";

export const vec2 = (x, y) => [x, y];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => Array.isArray(s) ? [a[0] * s[0], a[1] * s[1]] : [a[0] * s, a[1] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const len = (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1]);
export const dist = (a, b) => len(sub(a, b));
export const normalize = (v) => { const l = len(v); return l === 0 ? [0, 0] : [v[0] / l, v[1] / l]; };
export const rot90 = (v) => [v[1], -v[0]];

// Row-major 3x3 matrices, row-vector convention: [x,y,1] * M
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

function mat3InvertST(m) {
  const sx = 1 / m[0][0];
  const sy = 1 / m[1][1];
  return [
    [sx, 0, 0],
    [0, sy, 0],
    [-m[2][0] * sx, -m[2][1] * sy, 1],
  ];
}

export function transformPoint(p, m) {
  return [
    p[0] * m[0][0] + p[1] * m[1][0] + m[2][0],
    p[0] * m[0][1] + p[1] * m[1][1] + m[2][1],
  ];
}

export const transformPoints = (pts, m) => pts.map((p) => transformPoint(p, m));

export function scaleVector(v, m) {
  return [v[0] * m[0][0] + v[1] * m[1][0], v[0] * m[0][1] + v[1] * m[1][1]];
}

// Row-major to column-major Float32Array for gl.uniformMatrix3fv
function mat3ToFloat32(m) {
  return new Float32Array([
    m[0][0], m[1][0], m[2][0],
    m[0][1], m[1][1], m[2][1],
    m[0][2], m[1][2], m[2][2],
  ]);
}

export const BASE_PIXELS_PER_METER = 1000;

const translateMatrix = (dx, dy) => [[1,0,0], [0,1,0], [dx,dy,1]];
const scaleMatrix = (s) => [[s,0,0], [0,s,0], [0,0,1]];

function scaleAtMatrix(anchor, s) {
  return mat3Mul(
    mat3Mul(translateMatrix(-anchor[0], -anchor[1]), scaleMatrix(s)),
    translateMatrix(anchor[0], anchor[1])
  );
}

const fromScaleAndPos = (c) => [[c.scale,0,0], [0,c.scale,0], [c.pos[0],c.pos[1],1]];
const toScaleAndPos = (m) => ({ scale: m[0][0], pos: [m[2][0], m[2][1]] });

export function screenToClipMatrix(w, h) {
  const sx = 2 / w, sy = 2 / h;
  return [[sx,0,0], [0,-sy,0], [-1,1-sy,1]];
}

export function clipToWorldMatrix(w, h, camera) {
  const sx = w / BASE_PIXELS_PER_METER, sy = h / BASE_PIXELS_PER_METER;
  return mat3Mul([[sx,0,0], [0,-sy,0], [0,sy,1]], fromScaleAndPos(camera));
}

export const screenToWorldMatrix = (w, h, camera) =>
  mat3Mul(screenToClipMatrix(w, h), clipToWorldMatrix(w, h, camera));

export const worldToScreenMatrix = (w, h, camera) =>
  mat3InvertST(screenToWorldMatrix(w, h, camera));

export const screenToCanvasMatrix = (vw, vh, cw, ch) =>
  [[cw/vw,0,0], [0,ch/vh,0], [0,0,1]];

export const worldToCanvasMatrix = (vw, vh, cw, ch, camera) =>
  mat3Mul(worldToScreenMatrix(vw, vh, camera), screenToCanvasMatrix(vw, vh, cw, ch));

export const metersPerPixel = (w, h, camera) => screenToWorldMatrix(w, h, camera)[0][0];

export const canvasViewportScaling = (vw, vh, cw, ch) => [cw / vw, ch / vh];

export const transformCamera = (camera, m) =>
  toScaleAndPos(mat3Mul(fromScaleAndPos(camera), m));

export const zoomCamera = (camera, anchor, factor) =>
  transformCamera(camera, scaleAtMatrix(anchor, factor));

export const panCamera = (camera, dx, dy) =>
  transformCamera(camera, translateMatrix(dx, dy));

export function tukey(n, r) {
  const win = [];
  for (let i = 1; i <= n; i++) {
    const x = i / (n + 1);
    win.push(
      x < r / 2 ? 0.5 * (1 + Math.cos((2 * Math.PI / r) * (x - r / 2))) :
      x < 1 - r / 2 ? 1 :
      0.5 * (1 + Math.cos((2 * Math.PI / r) * (x - (1 - r / 2))))
    );
  }
  const mean = win.reduce((a, b) => a + b, 0) / n;
  return win.map((w) => w / mean);
}

const deg2rad = (deg) => deg / 180 * Math.PI;
const rad2deg = (rad) => rad / Math.PI * 180;
const angle = (v) => Math.atan2(v[1], v[0]);

function intersect(p1, p2, ang, vs) {
  const m1 = (p2[1] - p1[1]) / (p2[0] - p1[0]);
  const b1 = p1[1] - m1 * p1[0];
  const m2 = Math.tan(ang);
  const b2 = vs[1] - m2 * vs[0];
  const ix = (b2 - b1) / (m1 - m2);
  return [ix, b1 + m1 * ix];
}

function getWaveOrigin(c1, c2, vs) {
  return intersect(c1, c2, (angle(sub(c1, vs)) + angle(sub(c2, vs))) / 2, vs);
}

const focusedDelay = (pos, center, vs, spd) =>
  (dist(vs, pos) - dist(vs, center)) / spd;

function planeDelay(pos, center, vs, spd, naRad) {
  const fa = angle(sub(vs, center)) - Math.PI / 2 - 2 * naRad;
  const d = sub(pos, center);
  return (d[0] * Math.sin(fa) + d[1] * Math.cos(fa)) / spd;
}

function divergingDelay(pos, center, vs, spd) {
  const vsFlipped = sub(mul(center, 2), vs);
  return (dist(vsFlipped, center) - dist(vsFlipped, pos)) / spd;
}

export function elementGeometry(state) {
  const { center, nElements, arrayWidth, normalAzimuth, elementWidth } = state.probe;
  const { soundSpeed, virtualSource, soundSpeedTx } = state;
  const naRad = deg2rad(normalAzimuth);
  const cosNa = Math.cos(naRad), sinNa = Math.sin(naRad);

  const positions = nElements === 1 ? [center] :
    Array.from({ length: nElements }, (_, i) => {
      const r = (i / (nElements - 1) - 0.5) * arrayWidth;
      return [center[0] + r * cosNa, center[1] + r * sinNa];
    });

  const corner1 = positions[0];
  const corner2 = positions[nElements - 1];

  const waveOrigin = state.delayModel === "plane"
    ? center : getWaveOrigin(corner1, corner2, virtualSource);

  const delayFn = { focused: focusedDelay, plane: planeDelay, diverging: divergingDelay }[state.delayModel];
  const delays = positions.map((pos) =>
    delayFn ? (state.delayModel === "plane"
      ? planeDelay(pos, center, virtualSource, soundSpeedTx, naRad)
      : delayFn(pos, center, virtualSource, soundSpeedTx)) : 0
  );

  return {
    positions, delays,
    weights: tukey(nElements, state.tukeyRoll),
    corner1, corner2, center, nElements,
    normalAzimuthRad: naRad,
    width: elementWidth,
    waveOrigin,
    waveDirection: normalize(sub(virtualSource, waveOrigin)),
    t0: (dist(virtualSource, center) - dist(virtualSource, waveOrigin)) / soundSpeed,
    corner1VsAzimuth: angle(sub(corner1, virtualSource)),
    corner2VsAzimuth: angle(sub(corner2, virtualSource)),
  };
}

export function packElementTexture({ positions, delays, weights, normalAzimuthRad, width, nElements }) {
  const data = new Float32Array(512 * 4);
  for (let i = 0; i < nElements; i++) {
    const o = i * 8;
    data[o] = positions[i][0]; data[o+1] = positions[i][1];
    data[o+2] = weights[i]; data[o+3] = delays[i];
    data[o+4] = normalAzimuthRad; data[o+5] = width;
  }
  return data;
}

export function updateFromCorners(c1, c2) {
  const diff = sub(c1, c2);
  return {
    center: mul(add(c1, c2), 0.5),
    arrayWidth: len(diff),
    normalAzimuth: rad2deg(angle(diff)),
  };
}

export function getOptimalCanvasSize(nPixels, vw, vh) {
  const ratio = vw / vh;
  return [Math.round(Math.sqrt(nPixels * ratio)), Math.round(Math.sqrt(nPixels / ratio))];
}

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
  return {
    passes, fbos, gl, iteration: 0, prevStateKey: null,
    elementsTexture: createDataTexture(gl, new Float32Array(512 * 4), 512, 1),
  };
}

function stochasticStateKey(state) {
  return JSON.stringify([
    state.probe, state.virtualSource, state.centerFrequency, state.pulseLength,
    state.soundSpeed, state.soundSpeedTx, state.tukeyRoll, state.attenuationFactor,
    state.samplePoint, state.samplePointStrength, state.nPixels,
    state.simulationContainerSize, state.delayModel, state.camera,
  ]);
}

export function resizeMainSimulation(renderData, width, height) {
  if (width <= 0 || height <= 0) return;
  const { fbos, gl } = renderData;
  fbos.main.resize(width, height);
  fbos.maxAmplitudeMain.resize(width, height);
  fbos.maxAmplitudeCompare.resize(width, height);
  renderData.width = width;
  renderData.height = height;
}

function buildSimulationUniforms(state, geometry, vw, vh) {
  return {
    u_cameraMatrix: mat3ToFloat32(clipToWorldMatrix(vw, vh, state.camera)),
    u_elementsTexture: null,
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

function blitToCanvas(gl, canvas, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(gl.canvas, 0, 0);
}

export function renderMainFrame(renderData, state, visibleCanvas) {
  const { passes, fbos, elementsTexture, gl } = renderData;
  const [vw, vh] = state.simulationContainerSize;
  if (!vw || !vh) return;

  const [cw, ch] = getOptimalCanvasSize(state.nPixels, vw, vh);
  if (cw <= 0 || ch <= 0) return;

  if (renderData.width !== cw || renderData.height !== ch) {
    resizeMainSimulation(renderData, cw, ch);
    gl.canvas.width = cw;
    gl.canvas.height = ch;
  }

  const geometry = elementGeometry(state);
  updateDataTexture(gl, elementsTexture, packElementTexture(geometry), 512, 1);

  const baseUniforms = buildSimulationUniforms(state, geometry, vw, vh);
  baseUniforms.u_elementsTexture = elementsTexture;

  if (state.maximumAmplitudeSimulation) {
    renderMaxAmplitudeMode(renderData, state, baseUniforms);
  } else {
    passes.calculateField.draw({ ...baseUniforms, u_stochastic: false }, fbos.main);
    passes.postprocess.draw({
      t_simulatedField: fbos.main.textures[0],
      t_maximumAmplitudeValues: fbos.main.textures[0],
      t_maximumAmplitudeTimes: fbos.main.textures[1],
      u_minimumDb: state.minimumDb,
      u_maximumDb: state.maximumDb,
      u_useDb: state.displayDb,
      u_displayMode: displayModeIndex(state.displayMode),
    }, null);
  }

  blitToCanvas(gl, visibleCanvas, cw, ch);
}

function renderMaxAmplitudeMode(renderData, state, baseUniforms) {
  const { passes, fbos } = renderData;
  const key = stochasticStateKey(state);
  if (key !== renderData.prevStateKey) {
    renderData.prevStateKey = key;
    renderData.iteration = 0;
  }

  if (renderData.iteration === 0)
    passes.utility.draw({ u_operation: 0 }, fbos.maxAmplitudeMain);

  if (renderData.iteration < 500) {
    passes.calculateField.draw({
      ...baseUniforms, u_stochastic: true, u_seed: Math.random() * 1000,
      t_maximumAmplitudeValues: fbos.maxAmplitudeMain.textures[0],
      t_maximumAmplitudeTimes: fbos.maxAmplitudeMain.textures[1],
    }, fbos.maxAmplitudeCompare);

    passes.utility.draw({
      u_operation: 2,
      t_values: fbos.maxAmplitudeCompare.textures[0],
      t_times: fbos.maxAmplitudeCompare.textures[1],
    }, fbos.maxAmplitudeMain);

    renderData.iteration++;
  }

  passes.postprocess.draw({
    t_simulatedField: fbos.maxAmplitudeMain.textures[0],
    t_maximumAmplitudeValues: fbos.maxAmplitudeMain.textures[0],
    t_maximumAmplitudeTimes: fbos.maxAmplitudeMain.textures[1],
    u_minimumDb: state.minimumDb, u_maximumDb: state.maximumDb,
    u_useDb: state.displayDb, u_displayMode: displayModeIndex(state.displayMode),
  }, null);
}

const DISPLAY_MODES = { phase: 0, envelope: 1, intensity: 2, "time-delays": 3 };
const displayModeIndex = (mode) => DISPLAY_MODES[mode] ?? 0;

const N_TIMELINE_SAMPLES = 2048;

export function initTimeline(gl) {
  gl.getExtension("EXT_color_buffer_float");
  return {
    passes: {
      calculate: createRenderPass(gl, timelineFrag),
      postprocess: createRenderPass(gl, timelineFrag),
    },
    fbo: createFramebuffer(gl, N_TIMELINE_SAMPLES, 1),
    elementsTexture: createDataTexture(gl, new Float32Array(512 * 4), 512, 1),
    gl,
  };
}

export function renderTimelineFrame(renderData, state, visibleCanvas) {
  const { passes, fbo, elementsTexture, gl } = renderData;
  const isProbe = state.sampleTimelineAt === "probe";
  const width = N_TIMELINE_SAMPLES;
  const height = isProbe ? state.probe.nElements : 256;
  const renderHeight = isProbe ? state.probe.nElements : 1;

  if (gl.canvas.width !== width || gl.canvas.height !== height) {
    gl.canvas.width = width;
    gl.canvas.height = height;
  }
  fbo.resize(width, renderHeight);

  const geometry = elementGeometry(state);
  updateDataTexture(gl, elementsTexture, packElementTexture(geometry), 512, 1);

  const simUniforms = {
    u_elementsTexture: elementsTexture,
    u_nElements: geometry.nElements,
    u_samplePoint: state.samplePoint,
    u_samplePointStrength: state.samplePointStrength,
    u_centerFrequency: state.centerFrequency,
    u_pulseLength: state.pulseLength,
    u_soundSpeed: state.soundSpeed,
    u_attenuationFactor: state.attenuationFactor,
    u_minimumTime: state.timelineOffset,
    u_maximumTime: state.timelineOffset + state.timelineLength,
    u_sampleMode: isProbe ? 0 : 1,
  };

  passes.calculate.draw({ ...simUniforms, u_postprocess: false }, fbo);
  passes.postprocess.draw({
    ...simUniforms, u_postprocess: true,
    u_displayMode: displayModeIndex(state.displayMode),
    u_minimumDb: state.minimumDb, u_maximumDb: state.maximumDb,
    u_useDb: state.displayDb, u_textureWidth: N_TIMELINE_SAMPLES,
    u_timelineGain: state.timelineGain, t_simulatedField: fbo.textures[0],
  }, null);

  blitToCanvas(gl, visibleCanvas, width, height);
}

const N_BEAM_SAMPLES = 1024;

export function initBeamProfile(gl) {
  gl.getExtension("EXT_color_buffer_float");
  return {
    passes: {
      calculate: createRenderPass(gl, beamProfileFrag),
      selectMax: createRenderPass(gl, utilityFrag),
      copyTexture: createRenderPass(gl, utilityFrag),
      postprocess: createRenderPass(gl, beamProfileFrag),
    },
    fbos: {
      main: createFramebuffer(gl, N_BEAM_SAMPLES, 256),
      maxAmplitudeCurrent: createFramebuffer(gl, N_BEAM_SAMPLES, 256),
      maxAmplitudeCompare: createFramebuffer(gl, N_BEAM_SAMPLES, 256),
    },
    elementsTexture: createDataTexture(gl, new Float32Array(512 * 4), 512, 1),
    gl, iteration: 0, prevStateKey: null,
  };
}

// Everything that changes what the beam profile samples. Unlike the main
// simulation, time and the sample-line length matter here: they position the
// sample line along the beam.
function beamProfileStateKey(state) {
  return JSON.stringify([
    state.probe, state.virtualSource, state.centerFrequency, state.pulseLength,
    state.soundSpeed, state.soundSpeedTx, state.tukeyRoll, state.attenuationFactor,
    state.samplePoint, state.samplePointStrength, state.delayModel, state.time,
    state.plotType, state.beamProfileSampleLineLength,
  ]);
}

export function renderBeamProfileFrame(renderData, state, canvas) {
  const { passes, fbos, elementsTexture, gl } = renderData;
  const geometry = elementGeometry(state);
  updateDataTexture(gl, elementsTexture, packElementTexture(geometry), 512, 1);

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
    u_lateralBeamProfile: state.plotType === "lateral-beam-profile",
    u_beamProfileSampleLineLength: state.beamProfileSampleLineLength,
  };

  let sourceTex;
  if (state.plotUseMaximumAmplitude) {
    // Restart the accumulation when the sampled state changes, otherwise the
    // running maximum can only ever grow and the plot never comes back down.
    const key = beamProfileStateKey(state);
    if (key !== renderData.prevStateKey) {
      renderData.prevStateKey = key;
      renderData.iteration = 0;
    }

    const stochUniforms = { ...baseUniforms, u_stochastic: true, u_postprocess: false };
    if (renderData.iteration === 0)
      passes.calculate.draw({ ...stochUniforms, u_seed: Math.random() * 1000 }, fbos.maxAmplitudeCurrent);

    if (renderData.iteration < 200) {
      passes.calculate.draw({ ...stochUniforms, u_seed: Math.random() * 1000 }, fbos.maxAmplitudeCompare);
      passes.selectMax.draw({
        u_operation: 3,
        t_data1: fbos.maxAmplitudeCompare.textures[0],
        t_data2: fbos.maxAmplitudeCurrent.textures[0],
      }, fbos.main);
      passes.copyTexture.draw({ u_operation: 1, t_data: fbos.main.textures[0] }, fbos.maxAmplitudeCurrent);
      renderData.iteration++;
    }
    sourceTex = fbos.maxAmplitudeCurrent.textures[0];
  } else {
    passes.calculate.draw({ ...baseUniforms, u_stochastic: false, u_postprocess: false }, fbos.main);
    sourceTex = fbos.main.textures[0];
  }

  passes.postprocess.draw({
    ...baseUniforms, u_postprocess: true, u_stochastic: false,
    t_previousRender: sourceTex,
    u_plotMinimumDb: state.plotMinimumDb, u_plotMaximumDb: state.plotMaximumDb,
  }, null);

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(gl.canvas, 0, 0);
}
