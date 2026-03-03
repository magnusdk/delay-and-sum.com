# State Management

All state lives in `src/state.js` using Preact signals.

## Serialized Signals (from DEFAULTS)

These are persisted to the URL and restored on load:

| Signal | Type | Default |
|--------|------|---------|
| `camera` | `{ scale, pos: [x, y] }` | `{ scale: 0.08, pos: [0, -0.01] }` |
| `nPixels` | number | `1e6` |
| `virtualSource` | `[x, y]` | `[0, 0.04]` |
| `samplePoint` | `[x, y]` | `[-0.02, 0.05]` |
| `samplePointStrength` | number | `1` |
| `forceCurrentTimeAtFocus` | boolean | `false` |
| `centerFrequency` | number (Hz) | `3e6` |
| `pulseLength` | number (wavelengths) | `2` |
| `soundSpeed` | number (m/s) | `1540` |
| `soundSpeedTx` | number (m/s) | `1540` |
| `time` | number (seconds) | `0.065 / 1540` |
| `delayModel` | `"focused" \| "plane" \| "diverging"` | `"focused"` |
| `attenuationFactor` | number | `1` |
| `tukeyRoll` | number (0-1) | `0` |
| `displayMode` | `"phase" \| "envelope" \| "intensity" \| "time-delays"` | `"phase"` |
| `maximumAmplitudeSimulation` | boolean | `false` |
| `timelineOffset` | number (seconds) | `0` |
| `timelineLength` | number (seconds) | `1e-4` |
| `minimumDb` / `maximumDb` | number | `-60` / `0` |
| `displayDb` | boolean | `true` |
| `showSimplifiedGeometry` | boolean | `true` |
| `showGrid` | boolean | `true` |
| `sampleTimelineAt` | `"probe" \| "sample-point"` | `"probe"` |
| `timelineGain` | number | `1` |
| `plotType` | `"no-plot" \| "lateral-beam-profile" \| "axial-beam-profile"` | `"no-plot"` |
| `plotUseMaximumAmplitude` | boolean | `true` |
| `beamProfileSampleLineLength` | number (meters) | `0.02` |
| `plotMinimumDb` / `plotMaximumDb` | number | `-60` / `0` |
| `probe` | `{ center, nElements, arrayWidth, elementWidth, normalAzimuth }` | see DEFAULTS |

## UI-Only Signals (not serialized)

| Signal | Type | Purpose |
|--------|------|---------|
| `simulationContainerSize` | `[w, h]` | Main view pixel dimensions |
| `timelineContainerSize` | `[w, h]` | Timeline pixel dimensions |
| `menuOpen` | boolean | Mobile menu visibility |
| `isDragging` | boolean | True while dragging a menu slider |
| `simulationDraggable` | `{ hovering, dragging }` | Main view drag state |
| `timelineDraggable` | `{ hovering, dragging }` | Timeline drag state |
| `plotHover` | `{ pos, uvX, offsetX } \| null` | Beam profile hover position |
| `plotSampleLine` | `{ left, right } \| null` | Beam profile sample line endpoints |

## URL Serialization

- `computeDiff()` compares current signal values against `DEFAULTS` using `deepEqual()`
- Only changed values are stored as a diff object
- Serialized as `btoa(JSON.stringify(diff))` into the `?state=` query parameter
- `loadFromURL()` parses on startup, merges diff into defaults with `mergeDiff()`
- Auto-saves via a debounced `effect()` (100ms after any signal change)
- `resetState()` restores all signals to cloned defaults
- `getState()` returns a plain-object snapshot of all signals (serialized + UI-only)
