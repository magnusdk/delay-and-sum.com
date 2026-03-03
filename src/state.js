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

// plotHover: { pos, uvX, offsetX } or null
export const plotHover = signal(null);
// plotSampleLine: { left, right } or null
export const plotSampleLine = signal(null);

/** Snapshot all signal values into a plain object. */
export function getState() {
  const st = Object.fromEntries(
    Object.entries(signals).map(([k, sig]) => [k, sig.value])
  );
  st.simulationContainerSize = simulationContainerSize.value;
  st.timelineContainerSize = timelineContainerSize.value;
  st.menuOpen = menuOpen.value;
  st.isDragging = isDragging.value;
  st.simulationDraggable = simulationDraggable.value;
  st.timelineDraggable = timelineDraggable.value;
  st.plotHover = plotHover.value;
  st.plotSampleLine = plotSampleLine.value;
  return st;
}

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
    for (const [key, val] of Object.entries(changes)) {
      const sig = signals[key];
      if (!sig) continue;
      if (key === "probe") sig.value = mergeDiff(DEFAULTS.probe, val);
      else if (key === "camera") sig.value = mergeDiff(DEFAULTS.camera, val);
      else sig.value = val;
    }
  });
}

function computeDiff() {
  const diff = {};
  for (const [key, sig] of Object.entries(signals)) {
    const val = sig.value, def = DEFAULTS[key];
    if (key === "probe") {
      const probeDiff = {};
      let hasDiff = false;
      for (const [pk, pv] of Object.entries(val)) {
        if (!deepEqual(pv, def[pk])) {
          probeDiff[pk] = pv;
          hasDiff = true;
        }
      }
      if (hasDiff) diff["probe"] = probeDiff;
    } else if (!deepEqual(val, def)) {
      diff[key] = val;
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
