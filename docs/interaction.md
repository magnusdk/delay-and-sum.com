# Interaction

All input handling is in `src/interaction.js` via `initInteraction(element, options)`.

## FSM States

The interaction system tracks two state variables:

**inputState**: `"idle"` | `"single-touch"` | `"touch"` | `"wheel-pan"` | `"wheel-zoom"`
- Tracks the current input device / gesture type

**dragState**: `"idle"` | `"hovering"` | `"dragging"`
- Tracks the drag interaction lifecycle

Flow: `idle -> hovering` (mouse near draggable) -> `dragging` (mousedown) -> `idle` (mouseup)

## Draggable Protocol

Each draggable is an object with:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier (e.g. `"virtual-source"`, `"corner-1"`) |
| `type` | `"point"` or `"line"` | Hit-test shape |
| `pos` | `[x, y]` | Screen-space position (for points) |
| `corners` | `[[x,y], [x,y]]` | Screen-space endpoints (for lines) |
| `priority` | number (optional) | Higher = deprioritized (probe-body uses `1`) |
| `update` | `(prevPos, curPos, snap?)` | Called during drag with world-space coordinates |

`getDraggables()` is provided by `main-view.jsx` and returns the current set:
- `"virtual-source"` -- point, updates `state.virtualSource`
- `"sample-point"` -- point, updates `state.samplePoint`
- `"corner-1"` / `"corner-2"` -- points, update probe geometry via `updateFromCorners()`
- `"probe-body"` -- line (only when nElements > 1), translates probe center

## Camera Gestures

All require `supportCameraGestures = true` (default for main view).

| Gesture | Action |
|---------|--------|
| Scroll wheel | Pan camera (`deltaX`, `deltaY`) |
| Ctrl + scroll wheel | Zoom at pointer position |
| Two-finger pinch (touch) | Zoom + pan combined |

Wired in `main-view.jsx` via the `onCameraZoom`, `onCameraPan`, `onCameraTransform` callbacks,
which call `zoomCamera()` and `panCamera()` from `src/simulation.js`.

## Snap-to-Grid

Holding **Shift** activates `snapToGrid`. When active, `continueDrag()` uses
`pointerPos.simulationSnapToGrid` instead of `pointerPos.simulation`.
Grid snap resolution is derived from `metersPerPixel()` in the `getPos()` function
defined in `main-view.jsx`.

## Hit Testing

`closestDraggable(point)` finds the nearest draggable within `hoverDistance` (default 10px * DPR).
- Points: Euclidean distance from `pos`
- Lines: perpendicular distance to segment (clamped to endpoints)
- Priority penalty: `dist + priority * hoverDistance`
