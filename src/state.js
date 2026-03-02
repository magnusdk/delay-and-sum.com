import { signal, effect, batch } from "@preact/signals";

export const DEFAULTS = {
  camera: { scale: 0.08, pos: [0, -0.01] },
  nPixels: 1e6,
  virtualSource: [0, 0.04],
  samplePoint: [-0.02, 0.05],
  samplePointStrength: 1,
  forceCurrentTimeAtFocus: false,
  centerFrequency: 3e6,
  pulseLength: 2,
  soundSpeed: 1540,
  soundSpeedTx: 1540,
  time: 0.065 / 1540,
  delayModel: "focused",
  attenuationFactor: 1,
  tukeyRoll: 0,
  displayMode: "phase",
  maximumAmplitudeSimulation: false,
  timelineOffset: 0,
  timelineLength: 1e-4,
  minimumDb: -60,
  maximumDb: 0,
  displayDb: true,
  showSimplifiedGeometry: true,
  showGrid: true,
  sampleTimelineAt: "probe",
  timelineGain: 1,
  plotType: "no-plot",
  plotUseMaximumAmplitude: true,
  beamProfileSampleLineLength: 0.02,
  plotMinimumDb: -60,
  plotMaximumDb: 0,
  probe: {
    center: [0, 0],
    nElements: 256,
    arrayWidth: 2e-2,
    elementWidth: 6e-5,
    normalAzimuth: 0,
  },
};

function cloneDefault(v) {
  if (Array.isArray(v)) return [...v];
  if (v && typeof v === "object") return Object.fromEntries(
    Object.entries(v).map(([k, val]) => [k, cloneDefault(val)])
  );
  return v;
}

// Serializable signals (one per DEFAULTS field)
export const signals = Object.fromEntries(
  Object.entries(DEFAULTS).map(([k, v]) => [k, signal(cloneDefault(v))])
);

export const {
  camera, nPixels, virtualSource, samplePoint, samplePointStrength,
  forceCurrentTimeAtFocus, centerFrequency, pulseLength, soundSpeed, soundSpeedTx,
  time, delayModel, attenuationFactor, tukeyRoll, displayMode,
  maximumAmplitudeSimulation, timelineOffset, timelineLength,
  minimumDb, maximumDb, displayDb, showSimplifiedGeometry, showGrid,
  sampleTimelineAt, timelineGain, plotType, plotUseMaximumAmplitude,
  beamProfileSampleLineLength, plotMinimumDb, plotMaximumDb, probe,
} = signals;

// UI-only signals (not serialized to URL)
export const simulationContainerSize = signal([0, 0]);
export const timelineContainerSize = signal([0, 0]);
export const menuOpen = signal(false);
export const isDragging = signal(false);
export const simulationDraggable = signal({ hovering: null, dragging: null });
export const timelineDraggable = signal({ hovering: null, dragging: null });
export const plotHoverPos = signal(null);
export const plotHoverPosUvX = signal(null);
export const plotHoverPosOffsetX = signal(null);
export const plotLeftMostPos = signal(null);
export const plotRightMostPos = signal(null);

// JS camelCase <-> JSON kebab-case for backward compat with ClojureScript app
const KEY_MAP = {
  centerFrequency: "center-frequency",
  pulseLength: "pulse-length",
  soundSpeed: "sound-speed",
  soundSpeedTx: "sound-speed-tx",
  delayModel: "delay-model",
  attenuationFactor: "attenuation-factor",
  tukeyRoll: "tukey-roll",
  displayMode: "display-mode",
  maximumAmplitudeSimulation: "maximum-amplitude-simulation?",
  timelineOffset: "timeline-offset",
  timelineLength: "timeline-length",
  minimumDb: "minimum-db",
  maximumDb: "maximum-db",
  displayDb: "display-db?",
  showSimplifiedGeometry: "show-simplified-geometry?",
  showGrid: "show-grid?",
  sampleTimelineAt: "sample-timeline-at",
  timelineGain: "timeline-gain",
  virtualSource: "virtual-source",
  samplePoint: "sample-point",
  samplePointStrength: "sample-point-strength",
  forceCurrentTimeAtFocus: "force-current-time-at-focus",
  nPixels: "n-pixels",
  plotType: "plot-type",
  plotUseMaximumAmplitude: "plot-use-maximum-amplitude?",
  beamProfileSampleLineLength: "beam-profile-sample-line-length",
  plotMinimumDb: "plot-minimum-db",
  plotMaximumDb: "plot-maximum-db",
};

const PROBE_KEY_MAP = {
  nElements: "n-elements",
  arrayWidth: "array-width",
  elementWidth: "element-width",
  normalAzimuth: "normal-azimuth",
};

const REVERSE_KEY_MAP = Object.fromEntries(Object.entries(KEY_MAP).map(([k, v]) => [v, k]));
const REVERSE_PROBE_KEY_MAP = Object.fromEntries(Object.entries(PROBE_KEY_MAP).map(([k, v]) => [v, k]));

function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

function mapKeys(obj, map) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [map[k] || k, v]));
}

function mergeDiff(original, diff) {
  if (Array.isArray(original) && Array.isArray(diff))
    return original.map((v, i) => i < diff.length && diff[i] != null ? mergeDiff(v, diff[i]) : v);
  if (original && diff && typeof original === "object" && typeof diff === "object" && !Array.isArray(original)) {
    const out = { ...original };
    for (const k of Object.keys(diff))
      out[k] = k in original ? mergeDiff(original[k], diff[k]) : diff[k];
    return out;
  }
  return diff != null ? diff : original;
}

export function loadFromURL() {
  const stateParam = new URL(window.location.href).searchParams.get("state");
  if (!stateParam) return;

  let changes;
  try { changes = JSON.parse(atob(stateParam)); }
  catch (e) { console.warn("Failed to parse state from URL:", e); return; }

  batch(() => {
    for (const [jsonKey, val] of Object.entries(changes)) {
      const jsKey = REVERSE_KEY_MAP[jsonKey] || jsonKey;
      const sig = signals[jsKey];
      if (!sig) continue;
      if (jsKey === "probe") sig.value = mergeDiff(DEFAULTS.probe, mapKeys(val, REVERSE_PROBE_KEY_MAP));
      else if (jsKey === "camera") sig.value = mergeDiff(DEFAULTS.camera, val);
      else sig.value = val;
    }
  });
}

function computeDiff() {
  const diff = {};
  for (const [jsKey, sig] of Object.entries(signals)) {
    const val = sig.value, def = DEFAULTS[jsKey];
    if (jsKey === "probe") {
      const probeDiff = {};
      let hasDiff = false;
      for (const [pk, pv] of Object.entries(val)) {
        if (!deepEqual(pv, def[pk])) {
          probeDiff[PROBE_KEY_MAP[pk] || pk] = pv;
          hasDiff = true;
        }
      }
      if (hasDiff) diff["probe"] = probeDiff;
    } else if (!deepEqual(val, def)) {
      diff[KEY_MAP[jsKey] || jsKey] = val;
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

export function saveToURL() {
  const diff = computeDiff();
  const url = new URL(window.location.href);
  if (diff) url.searchParams.set("state", btoa(JSON.stringify(diff)));
  else url.searchParams.delete("state");
  window.history.replaceState({}, "", url.toString());
}

export function resetState() {
  batch(() => {
    for (const [jsKey, sig] of Object.entries(signals))
      sig.value = cloneDefault(DEFAULTS[jsKey]);
  });
}

effect(() => {
  if (!forceCurrentTimeAtFocus.value) return;
  const vs = virtualSource.value, pc = probe.value.center, ss = soundSpeed.value;
  time.value = Math.sqrt((vs[0] - pc[0]) ** 2 + (vs[1] - pc[1]) ** 2) / ss;
});

let saveTimeout = null;
effect(() => {
  for (const sig of Object.values(signals)) sig.value;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveToURL, 100);
});

loadFromURL();
