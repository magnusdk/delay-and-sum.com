import { signal, effect, batch } from "@preact/signals";

// ---- Defaults (used for URL diffing) ----
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

// ---- Signals (one per state field) ----
export const camera = signal({ scale: DEFAULTS.camera.scale, pos: [...DEFAULTS.camera.pos] });
export const nPixels = signal(DEFAULTS.nPixels);
export const virtualSource = signal([...DEFAULTS.virtualSource]);
export const samplePoint = signal([...DEFAULTS.samplePoint]);
export const samplePointStrength = signal(DEFAULTS.samplePointStrength);
export const forceCurrentTimeAtFocus = signal(DEFAULTS.forceCurrentTimeAtFocus);
export const centerFrequency = signal(DEFAULTS.centerFrequency);
export const pulseLength = signal(DEFAULTS.pulseLength);
export const soundSpeed = signal(DEFAULTS.soundSpeed);
export const soundSpeedTx = signal(DEFAULTS.soundSpeedTx);
export const time = signal(DEFAULTS.time);
export const delayModel = signal(DEFAULTS.delayModel);
export const attenuationFactor = signal(DEFAULTS.attenuationFactor);
export const tukeyRoll = signal(DEFAULTS.tukeyRoll);
export const displayMode = signal(DEFAULTS.displayMode);
export const maximumAmplitudeSimulation = signal(DEFAULTS.maximumAmplitudeSimulation);
export const timelineOffset = signal(DEFAULTS.timelineOffset);
export const timelineLength = signal(DEFAULTS.timelineLength);
export const minimumDb = signal(DEFAULTS.minimumDb);
export const maximumDb = signal(DEFAULTS.maximumDb);
export const displayDb = signal(DEFAULTS.displayDb);
export const showSimplifiedGeometry = signal(DEFAULTS.showSimplifiedGeometry);
export const showGrid = signal(DEFAULTS.showGrid);
export const sampleTimelineAt = signal(DEFAULTS.sampleTimelineAt);
export const timelineGain = signal(DEFAULTS.timelineGain);
export const plotType = signal(DEFAULTS.plotType);
export const plotUseMaximumAmplitude = signal(DEFAULTS.plotUseMaximumAmplitude);
export const beamProfileSampleLineLength = signal(DEFAULTS.beamProfileSampleLineLength);
export const plotMinimumDb = signal(DEFAULTS.plotMinimumDb);
export const plotMaximumDb = signal(DEFAULTS.plotMaximumDb);
export const probe = signal({
  center: [...DEFAULTS.probe.center],
  nElements: DEFAULTS.probe.nElements,
  arrayWidth: DEFAULTS.probe.arrayWidth,
  elementWidth: DEFAULTS.probe.elementWidth,
  normalAzimuth: DEFAULTS.probe.normalAzimuth,
});

// ---- UI-only signals (not serialized to URL) ----
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

// ---- Map of all serializable signals keyed by JS name ----
const SIGNAL_MAP = {
  camera, nPixels, virtualSource, samplePoint, samplePointStrength,
  forceCurrentTimeAtFocus, centerFrequency, pulseLength, soundSpeed, soundSpeedTx,
  time, delayModel, attenuationFactor, tukeyRoll, displayMode,
  maximumAmplitudeSimulation, timelineOffset, timelineLength,
  minimumDb, maximumDb, displayDb, showSimplifiedGeometry, showGrid,
  sampleTimelineAt, timelineGain, plotType, plotUseMaximumAmplitude,
  beamProfileSampleLineLength, plotMinimumDb, plotMaximumDb, probe,
};

// ---- URL Serialization ----
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

// Probe sub-object keys: JS camelCase <-> JSON kebab-case
const PROBE_KEY_MAP = {
  nElements: "n-elements",
  arrayWidth: "array-width",
  elementWidth: "element-width",
  normalAzimuth: "normal-azimuth",
};

// Reverse maps
const REVERSE_KEY_MAP = Object.fromEntries(Object.entries(KEY_MAP).map(([k, v]) => [v, k]));
const REVERSE_PROBE_KEY_MAP = Object.fromEntries(Object.entries(PROBE_KEY_MAP).map(([k, v]) => [v, k]));

function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

// Convert probe object keys to kebab-case for serialization
function probeToKebab(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[PROBE_KEY_MAP[k] || k] = v;
  }
  return out;
}

// Convert probe object keys from kebab-case to camelCase
function probeFromKebab(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[REVERSE_PROBE_KEY_MAP[k] || k] = v;
  }
  return out;
}

// Deep merge: apply diff onto original, like the ClojureScript merge-diff
function mergeDiff(original, diff) {
  if (Array.isArray(original) && Array.isArray(diff)) {
    return original.map((v, i) => i < diff.length && diff[i] != null ? mergeDiff(v, diff[i]) : v);
  }
  if (original && diff && typeof original === "object" && typeof diff === "object" && !Array.isArray(original)) {
    const out = { ...original };
    for (const k of Object.keys(diff)) {
      out[k] = k in original ? mergeDiff(original[k], diff[k]) : diff[k];
    }
    return out;
  }
  return diff != null ? diff : original;
}

export function loadFromURL() {
  const params = new URL(window.location.href).searchParams;
  const stateParam = params.get("state");
  if (!stateParam) return;

  let changes;
  try {
    changes = JSON.parse(atob(stateParam));
  } catch (e) {
    console.warn("Failed to parse state from URL:", e);
    return;
  }

  batch(() => {
    for (const [jsonKey, val] of Object.entries(changes)) {
      // Map kebab-case JSON key to JS camelCase
      const jsKey = REVERSE_KEY_MAP[jsonKey] || jsonKey;
      const sig = SIGNAL_MAP[jsKey];
      if (!sig) continue;

      if (jsKey === "probe") {
        // Deep merge probe changes
        const probeChanges = probeFromKebab(val);
        sig.value = mergeDiff(DEFAULTS.probe, probeChanges);
      } else if (jsKey === "camera") {
        sig.value = mergeDiff(DEFAULTS.camera, val);
      } else {
        sig.value = val;
      }
    }
  });
}

function computeDiff() {
  const diff = {};
  for (const [jsKey, sig] of Object.entries(SIGNAL_MAP)) {
    const val = sig.value;
    const def = DEFAULTS[jsKey];
    if (jsKey === "probe") {
      const probeDiff = {};
      let hasDiff = false;
      for (const [pk, pv] of Object.entries(val)) {
        if (!deepEqual(pv, def[pk])) {
          const kebabPk = PROBE_KEY_MAP[pk] || pk;
          probeDiff[kebabPk] = pv;
          hasDiff = true;
        }
      }
      if (hasDiff) diff["probe"] = probeDiff;
    } else if (!deepEqual(val, def)) {
      const jsonKey = KEY_MAP[jsKey] || jsKey;
      diff[jsonKey] = val;
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

export function saveToURL() {
  const diff = computeDiff();
  const url = new URL(window.location.href);
  if (diff) {
    url.searchParams.set("state", btoa(JSON.stringify(diff)));
  } else {
    url.searchParams.delete("state");
  }
  window.history.replaceState({}, "", url.toString());
}

export function resetState() {
  batch(() => {
    for (const [jsKey, sig] of Object.entries(SIGNAL_MAP)) {
      const def = DEFAULTS[jsKey];
      if (jsKey === "probe") {
        sig.value = { ...def, center: [...def.center] };
      } else if (jsKey === "camera") {
        sig.value = { scale: def.scale, pos: [...def.pos] };
      } else if (Array.isArray(def)) {
        sig.value = [...def];
      } else {
        sig.value = def;
      }
    }
  });
}

// ---- Dependent state: force time at focus ----
effect(() => {
  if (forceCurrentTimeAtFocus.value) {
    const vs = virtualSource.value;
    const pc = probe.value.center;
    const ss = soundSpeed.value;
    const dist = Math.sqrt((vs[0] - pc[0]) ** 2 + (vs[1] - pc[1]) ** 2);
    time.value = dist / ss;
  }
});

// ---- Auto-save state to URL (debounced 100ms) ----
let saveTimeout = null;
effect(() => {
  // Read all serializable signals to subscribe to changes
  for (const sig of Object.values(SIGNAL_MAP)) sig.value;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveToURL, 100);
});

// ---- Load state from URL on init ----
loadFromURL();
