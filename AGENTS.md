# delay-and-sum.com — Agent Guide

Interactive ultrasound beamforming simulator. Rewritten from ClojureScript + Three.js to JavaScript + Preact + WebGL2.

## Quick Start

```bash
npm run dev      # Start dev server on port 3000
npm run build    # Production build → dist/
npm run test     # Playwright tests (requires browser)
```

## File Map (21 files, ~4400 LOC)

| File | Purpose | Key exports |
|------|---------|-------------|
| `src/state.js` | All app state as Preact Signals + URL serialization | `camera`, `probe`, `virtualSource`, `time`, `displayMode`, ... |
| `src/simulation.js` | Probe math, camera matrices, WebGL render pipeline | `elementGeometry`, `clipToWorldMatrix`, `initMainSimulation`, `renderMainFrame`, `initTimeline`, `renderTimelineFrame`, `initBeamProfile`, `renderBeamProfileFrame` |
| `src/webgl.js` | WebGL2 abstraction (shader compile, FBO, render pass) | `createRenderPass`, `createFramebuffer`, `createDataTexture` |
| `src/interaction.js` | Pointer/wheel/touch input → camera transforms + dragging | `initInteraction` |
| `src/components/main-view.jsx` | Canvas stack (WebGL + Canvas2D overlay + grid) | `MainView` |
| `src/components/overlays.jsx` | Canvas2D: wave geometry arcs, probe dots, drag points | `Overlays` |
| `src/components/grid.jsx` | CSS grid lines + tick labels | `Grid` |
| `src/components/timeline.jsx` | Timeline panel (WebGL + cursor + ticks) | `Timeline` |
| `src/components/beam-profile.jsx` | Beam profile plot (WebGL + hover line) | `BeamProfile` |
| `src/components/menu.jsx` | Settings menu (sliders, selects, checkboxes) | `Menu` |
| `src/shaders/common.glsl` | GLSL utilities: pack/unpack, dB, rand, lineSDF | included by all shaders |
| `src/shaders/elements.glsl` | Element struct, signal math (requires uniform declarations) | included by simulation/timeline/beam-profile |
| `src/shaders/simulation.frag` | Field simulation (fixed-time + stochastic via `u_stochastic`) | |
| `src/shaders/postprocess.frag` | Display modes: phase/envelope/intensity/time-delays | |
| `src/shaders/timeline.frag` | Timeline rendering (probe + scatterer modes) | |
| `src/shaders/beam-profile.frag` | Beam profile (fixed + stochastic + postprocess) | |
| `src/shaders/utility.frag` | Clear, copy, select-max (via `u_operation` flag) | |
| `src/shaders/vertex.glsl` | Fullscreen quad vertex shader | |
| `src/style.css` | All CSS (~420 lines) | |
| `src/app.jsx` | Root layout: MainView + Timeline + Menu + BeamProfile | `App` |
| `src/main.jsx` | Mount point (5 lines) | |

## Architecture

### State → Signals → URL
Every piece of app state is a Preact Signal in `state.js`. Components subscribe automatically. Changes auto-save to `?state=` URL param (base64-encoded JSON diff against defaults). Backward compatible with original ClojureScript URL format.

### Rendering Pipeline
Multi-pass fullscreen-quad WebGL2 rendering on a hidden canvas, then `drawImage()` to visible canvas.

**Standard mode:** Clear → Simulate (`simulation.frag`) → Postprocess (`postprocess.frag`) → drawImage

**Max-amplitude mode:** Clear → 500x stochastic iterations (simulate → select-max ping-pong) → Postprocess → drawImage

### WebGL Abstraction
`webgl.js` provides three key functions:
- `createRenderPass(gl, vertSrc, fragSrc)` → `{ program, draw(uniforms, fbo?) }`
- `createFramebuffer(gl, w, h, count)` → FBO with MRT color attachments
- `createDataTexture(gl, data, w, h)` → RGBA32F texture

### Shader Consolidation
19 original shaders → 7 files via uniform flags (`u_stochastic`, `u_displayMode`, `u_operation`, `u_postprocess`, `u_sampleMode`). `vite-plugin-glsl` resolves `#include` at build time.

### Coordinate System
- **Screen pixels** → `screenToClipMatrix` → **Clip [-1,1]** → `clipToWorldMatrix` → **World (meters)**
- Camera: `{ scale: 0.08, pos: [0, -0.01] }` — scale is world-meters per clip-unit
- All physics in meters; display converts to mm/MHz/etc in menu

## How-To

### Add a new control to the menu
1. Add default value in `state.js` → `DEFAULTS`
2. Add signal: `export const myField = signal(DEFAULTS.myField);`
3. Add to `SIGNAL_MAP` and `KEY_MAP` (if URL-serializable)
4. Add slider/select/checkbox in `menu.jsx` under the appropriate section

### Add a new display mode
1. Add case in `postprocess.frag` → new `u_displayMode` value
2. Add case in `simulation.js` → `displayModeIndex()`
3. Add option in `menu.jsx` → display mode select

### Add a new shader pass
1. Create or modify shader in `src/shaders/`
2. In `simulation.js`, add `createRenderPass(gl, null, fragSrc)` in the init function
3. Add draw call in the render function: `passes.myPass.draw(uniforms, targetFbo)`

### Modify probe geometry
Edit `elementGeometry()` in `simulation.js`. It computes element positions, delays (focused/plane/diverging), weights (Tukey apodization), and packs them into a 512x1 RGBA32F texture.

### Add a new draggable object
1. Add it to the draggables list in `main-view.jsx` → `getDraggables()`
2. Provide `type` ("point" or "line"), position data, and `update` callback
3. The interaction system handles hover detection and drag FSM automatically
