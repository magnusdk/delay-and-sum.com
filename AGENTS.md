# delay-and-sum.com -- Agent Guide

Interactive ultrasound beamforming simulator built with Preact + Signals + WebGL2.

## Quick Start

```bash
npm run dev          # Vite dev server on port 3000
npm run build        # Production build -> dist/
npm run test         # Playwright E2E tests (needs Chromium + SwiftShader)
npx playwright test  # Same, explicit
```

Tech stack: **Preact 10** + **@preact/signals** + **WebGL2** + **Vite 6** + **vite-plugin-glsl** (shader `#include`).

## Project Structure

| File | Lines | Purpose |
|------|------:|---------|
| `src/main.jsx` | 5 | Mount point: renders `<App>` into `#root` |
| `src/app.jsx` | 35 | Root layout: MainView + Timeline + Menu + BeamProfile |
| `src/state.js` | 186 | All app state as Preact Signals; URL serialization (base64 JSON diff) |
| `src/webgl.js` | 204 | WebGL2 helpers: shader compile, FBO/MRT, render pass, data textures |
| `src/simulation.js` | 505 | Probe math, camera matrices, three WebGL render pipelines (main/timeline/beam-profile) |
| `src/interaction.js` | 206 | Pointer/wheel/touch FSM: draggable protocol + camera gestures |
| `src/style.css` | 360 | All CSS: layout, menu, timeline, controls, mobile responsive |
| `src/components/main-view.jsx` | 684 | Simulation canvas stack + Canvas2D overlays (wave geometry, probe, dots, grid) |
| `src/components/menu.jsx` | 370 | Data-driven settings panel: MENU_SECTIONS array, Slider/Select/Checkbox |
| `src/components/timeline.jsx` | 154 | Timeline panel: WebGL canvas + time cursor + tick labels |
| `src/components/beam-profile.jsx` | 114 | Floating beam profile plot: WebGL canvas + hover line |
| `src/shaders/vertex.glsl` | 7 | Fullscreen quad vertex shader (shared by all passes) |
| `src/shaders/common.glsl` | 117 | GLSL utilities: pack/unpack, dB conversion, rand, lineSDF, displayPhaseKernel |
| `src/shaders/elements.glsl` | 98 | Element struct, getElement() texture lookup, gaussianWeightedSine, signalForPoint |
| `src/shaders/simulation.frag` | 57 | Main field simulation (deterministic + stochastic via `u_stochastic` flag) |
| `src/shaders/postprocess.frag` | 46 | Display mode mapping: phase/envelope/intensity/time-delays |
| `src/shaders/timeline.frag` | 84 | Timeline rendering (probe mode + scatterer mode, raw + postprocess) |
| `src/shaders/beam-profile.frag` | 81 | Beam profile (lateral/axial, deterministic/stochastic, simulation/postprocess) |
| `src/shaders/utility.frag` | 51 | Utility ops via `u_operation`: clear, copy, copy-MRT, select-max |
| **Total** | **3364** | **10 JS/JSX + 8 GLSL/frag + 1 CSS = 19 source files** |

Config files: `vite.config.js`, `package.json`, `playwright.config.js`, `index.html`.

## Architecture Overview

### State Layer

All application state lives as Preact Signals in `src/state.js`. The `DEFAULTS` object defines every parameter (camera, probe geometry, display settings, etc.). Each default becomes an individually exported signal. Components re-render automatically on signal changes. State is serialized to the URL `?state=` param as a base64-encoded JSON diff against defaults, with debounced saves via `effect()`. `getState()` snapshots all signals into a plain object for the render loops.

-> See `docs/state.md`

### Rendering Pipeline

Three independent WebGL render loops run via `requestAnimationFrame` -- one each for the main simulation view, the timeline, and the beam profile. Each uses a **hidden offscreen GL context** (`createHiddenGL()`) that renders to FBOs, then blits to a visible `<canvas>` via `ctx.drawImage(gl.canvas)`. The main simulation has two modes: single-frame deterministic and iterative stochastic max-amplitude (500 iterations with ping-pong FBOs). All rendering is fullscreen-quad based.

-> See `docs/rendering.md`

### Shader System

Eight GLSL files in `src/shaders/`. `common.glsl` and `elements.glsl` are shared via `#include` (resolved at build time by vite-plugin-glsl). Shaders use **uniform flags** to combine what were originally many separate files: `u_stochastic` (deterministic vs stochastic), `u_postprocess` (simulation vs display), `u_operation` (utility ops), `u_sampleMode` (probe vs scatterer), `u_displayMode` (phase/envelope/intensity/time-delays). The vertex shader is a simple fullscreen quad; `webgl.js` also provides `FULLSCREEN_VERT` as an inline fallback.

-> See `docs/shaders.md`

### Coordinate System

Three coordinate spaces connected by 3x3 row-major matrices (row-vector convention):
- **Screen pixels** -> `screenToClipMatrix(w,h)` -> **Clip [-1,1]** -> `clipToWorldMatrix(w,h,camera)` -> **World (meters)**
- Camera is `{ scale, pos }` where scale = world-meters per clip-unit
- `worldToScreenMatrix`, `worldToCanvasMatrix`, and `screenToCanvasMatrix` provide the inverse/composite transforms
- All physics computations use meters; the menu converts to mm/MHz/degrees for display

### Interaction System

`src/interaction.js` exports `initInteraction(element, options)` which sets up a pointer/wheel/touch **finite state machine** with states: idle, hovering, dragging, wheel-pan, wheel-zoom, touch. It implements a **draggable protocol**: callers provide `getDraggables()` returning objects with `{ name, type, pos/corners, update(prev, cur) }`. The FSM handles hit-testing (nearest draggable within `hoverDistance`), drag start/continue/end, Shift-to-snap-to-grid, camera wheel zoom (Ctrl+wheel) and pan (plain wheel), and two-finger touch gestures. `main-view.jsx` defines draggables for: virtual-source, sample-point, corner-1, corner-2, probe-body.

### Menu System

`src/components/menu.jsx` uses a data-driven `MENU_SECTIONS` array. Each section has a title (collapsible) and an array of control descriptors: `{ type, signal, path, ...opts }`. A generic `renderControl()` dispatcher maps types to components (`Slider`, `Select`, `Checkbox`, or `custom` render functions). The `Slider` component supports drag-to-adjust (pointer events) and direct text input, with configurable magnitude/sensitivity/units/clamping.

-> See `docs/menu.md`

## Common Tasks

### 1. Add a new signal/parameter
- `src/state.js`: add to `DEFAULTS`, it auto-creates a signal; add to destructured export
- `src/components/menu.jsx`: add control to appropriate `MENU_SECTIONS` entry

### 2. Add a new display mode
- `src/shaders/postprocess.frag`: add new `u_displayMode` case
- `src/simulation.js`: add entry to `DISPLAY_MODES` map
- `src/components/menu.jsx`: add option to the display mode `Select` (in "Field display options" section)

### 3. Add a new shader pass
- `src/shaders/`: create or modify a `.frag` file (use `#include "./common.glsl"` and `"./elements.glsl"` as needed)
- `src/simulation.js`: import the shader, add `createRenderPass()` in the relevant `init*()` function, add draw call in the `render*Frame()` function

### 4. Modify probe/element geometry
- `src/simulation.js`: `elementGeometry()` (positions, delays, weights, Tukey apodization) and `packElementTexture()` (RGBA32F texture layout)

### 5. Add a new draggable to the simulation view
- `src/components/main-view.jsx`: add to `getDraggables()` array with `{ name, type, pos, update }` protocol
- `src/components/main-view.jsx`: add drawing logic in `drawSimulationUI()` if it needs a visual indicator

### 6. Add a new overlay visualization
- `src/components/main-view.jsx`: add drawing function (Canvas2D), call it from `drawSimulationUI()` or `drawWaveGeometry()`
- Uses `worldToCanvasMatrix` to transform world coords to canvas pixels

### 7. Modify the timeline
- `src/components/timeline.jsx`: component structure, pointer events, tick labels
- `src/simulation.js`: `initTimeline()` and `renderTimelineFrame()` for WebGL rendering
- `src/shaders/timeline.frag`: shader logic (probe mode vs scatterer mode)

### 8. Modify the beam profile plot
- `src/components/beam-profile.jsx`: component, hover interaction, sample line computation
- `src/simulation.js`: `initBeamProfile()` and `renderBeamProfileFrame()`
- `src/shaders/beam-profile.frag`: shader logic (lateral vs axial, deterministic vs stochastic)

### 9. Change CSS/layout
- `src/style.css`: all styles (layout containers, menu, timeline, controls, grid ticks, mobile responsive breakpoint at 750px)
- `src/app.jsx`: top-level DOM structure

### 10. Add or modify tests
- `tests/helpers.js`: shared selectors and wait helpers -- use these rather than fixed sleeps
- `tests/smoke.spec.js`: page load, layout, controls, in one page load
- `tests/url-state.spec.js`: URL state round-trip and malformed-input handling
- `tests/*.spec.js` tagged `@slow`: WebGL-heavy regression tests (see Testing below)

## Testing

**Do not run the test suite after every edit.** It drives real WebGL through
software rendering, so even the fast subset takes about a minute -- far too slow
for an inner loop. Write code, reason about it, and run the tests **once, before
committing**.

```bash
npm test         # fast subset, ~1 min -- run this before committing
npm run test:all # everything including @slow, ~3.5 min
npx playwright test tests/smoke.spec.js   # a single file
```

Tests tagged `@slow` are excluded from `npm test`. They cover WebGL resource
lifecycle and the stochastic accumulator, which need many seconds of real
rendering to say anything meaningful.

| File | Tag | What it covers |
|------|-----|----------------|
| `smoke.spec.js` | fast | Page loads and renders, layout, menu controls, no console errors |
| `url-state.spec.js` | fast | URL state round-trip; malformed state must not wedge the app |
| `wave-geometry.spec.js` | fast | The geometry overlay clears when switched off and repaints when switched on |
| `beam-profile.spec.js` | `@slow` | Beam profiles track state changes after the accumulator converges |
| `plot-lifecycle.spec.js` | `@slow` | Plots survive close/reopen; overlays and WebGL contexts are released |
| `feedback-loop.spec.js` | `@slow` | No GL_INVALID_OPERATION or feedback-loop errors across parameter changes |

### When a test fails

**Report the failure to the user and let them decide.** Do not assume the test is
correct and rewrite the code to satisfy it, and do not "fix" the test to make it
pass. A red test means *something changed* -- whether that change is a bug or an
intended new behaviour is the user's call, not yours. Say which test failed, what
it asserted, and what the code now does.

Verification here is ultimately visual: the maintainers check behaviour by looking
at the running app. The suite is a coarse safety net for regressions that are easy
to miss by eye (a canvas that never clears, a leaked WebGL context), not a
specification of correct output.

### Notes

Playwright runs Chromium with `--use-gl=swiftshader` for headless WebGL, and the
`webServer` config auto-starts Vite on port 3000. Rendering is slow and timing
varies with load, so tests poll for conditions via `tests/helpers.js` instead of
sleeping for fixed durations. `retries: 1` is set, since occasional cold-start
races are expected.
