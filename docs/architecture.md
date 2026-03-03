# Architecture

## Tech Stack

Preact + Signals for UI, WebGL2 for GPU-accelerated simulation, Vite for bundling.
Entry point: `src/main.jsx` renders `<App />` into `#root`.

## Component Tree

```
App (src/app.jsx)
 +-- MainView (src/components/main-view.jsx)   -- simulation canvas + overlay + grid
 +-- Timeline  (src/components/timeline.jsx)    -- time-domain waveform strip
 +-- Menu      (src/components/menu.jsx)        -- parameter controls sidebar
 +-- BeamProfile (src/components/beam-profile.jsx) -- optional lateral/axial plot
```

Layout: `MainView` and `Timeline` stack vertically; `Menu` sits to the right.
`BeamProfile` renders below everything, only when `plotType !== "no-plot"`.

## Data Flow

1. **Signals** (`src/state.js`) hold all simulation parameters as Preact signals.
2. Each component with a render loop calls `getState()` every frame to snapshot signals.
3. The snapshot feeds into GPU render functions in `src/simulation.js`.
4. WebGL draws to a **hidden canvas**, then `ctx.drawImage()` blits to the visible canvas.

## Three Independent Render Loops

Each of these runs its own `requestAnimationFrame` loop with its own hidden WebGL2 context:

| Loop | Component | Init function | Render function |
|------|-----------|---------------|-----------------|
| Main simulation | `MainView` | `initMainSimulation()` | `renderMainFrame()` |
| Timeline | `Timeline` | `initTimeline()` | `renderTimelineFrame()` |
| Beam profile | `BeamProfile` | `initBeamProfile()` | `renderBeamProfileFrame()` |

## Hidden GL Context Pattern

`createHiddenGL()` in `src/webgl.js` creates an off-screen `<canvas>` with a WebGL2 context.
Shaders render to that hidden canvas (or to FBOs). The final pass draws to the hidden canvas
(FBO = null), then `blitToCanvas(gl, visibleCanvas, w, h)` copies pixels via `drawImage()`.

This avoids DOM-attached WebGL canvases and lets each pipeline own its GL state.

## Init vs Render Lifecycle

**Init** (once per mount in `useEffect`):
- Create hidden GL context via `createHiddenGL()`
- Create render passes (compiled shader programs) and framebuffers
- Create element data texture (512x1 RGBA32F)
- Set up interaction handlers (main view only)
- Start `requestAnimationFrame` loop

**Render** (every frame):
- `getState()` snapshots all signals
- Recompute element geometry (`elementGeometry()`)
- Upload element data to GPU texture
- Execute shader passes (simulate -> postprocess)
- Blit result to visible canvas

## Key Files

| File | Role |
|------|------|
| `src/state.js` | Signal definitions, URL serialization, defaults |
| `src/simulation.js` | Math utilities, coordinate transforms, GPU pipeline orchestration |
| `src/webgl.js` | WebGL2 helpers: shader compilation, render passes, FBOs, textures |
| `src/interaction.js` | Mouse/touch input FSM for dragging and camera gestures |
| `src/app.jsx` | Root component, WebGL2 support check |
| `src/components/main-view.jsx` | Main simulation view with canvas overlay drawing |
| `src/components/timeline.jsx` | Time-domain waveform display |
| `src/components/menu.jsx` | Data-driven parameter menu |
| `src/components/beam-profile.jsx` | Beam profile plot (lateral/axial) |
| `src/shaders/*.glsl, *.frag` | GLSL shader source files |
