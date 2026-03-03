# Rendering Pipelines

All rendering code is in `src/simulation.js`. Each pipeline uses a hidden WebGL2 context
created by `createHiddenGL()` (`src/webgl.js`) and blits results to a visible canvas.

## Main Simulation Pipeline

**Init**: `initMainSimulation(gl)` -- creates 3 render passes and 3 FBOs.

**Render passes** (shader programs):
- `calculateField` -- `simulation.frag` (field computation)
- `postprocess` -- `postprocess.frag` (colormap / display mode)
- `utility` -- `utility.frag` (clear, copy, max-select operations)

**FBOs** (all 2-attachment for value + time):
- `main` -- primary simulation output
- `maxAmplitudeMain` -- accumulated max-amplitude result
- `maxAmplitudeCompare` -- candidate for comparison

### Normal Mode (`maximumAmplitudeSimulation = false`)
```
calculateField(u_stochastic=false) -> FBO main
postprocess(main.textures) -> screen (FBO null)
drawImage -> visible canvas
```

### Maximum Amplitude Mode (`maximumAmplitudeSimulation = true`)
Uses stochastic sampling with up to 500 iterations:

1. **First iteration**: `utility(CLEAR)` -> `maxAmplitudeMain`
2. **Each iteration** (while `iteration < 500`):
   - `calculateField(u_stochastic=true, random seed)` -> `maxAmplitudeCompare` (shader reads current max from `maxAmplitudeMain` and keeps the larger amplitude)
   - `utility(COPY_MRT)` copies result back -> `maxAmplitudeMain`
3. **Final**: `postprocess(maxAmplitudeMain.textures)` -> screen

State changes (detected via `stochasticStateKey()`) reset the iteration counter.

### Canvas Size Calculation
`getOptimalCanvasSize(nPixels, vw, vh)` computes canvas dimensions that preserve the
viewport aspect ratio while targeting `nPixels` total pixels (default 1M).

## Timeline Pipeline

**Init**: `initTimeline(gl)` -- 2 passes sharing `timeline.frag`, 1 FBO.

- Width: 2048 samples (constant `N_TIMELINE_SAMPLES`)
- Height: `probe.nElements` (probe mode) or 1 (scatterer mode)

```
calculate(u_postprocess=false, u_sampleMode) -> FBO
postprocess(u_postprocess=true, FBO texture) -> screen
drawImage -> visible canvas
```

Probe mode (`sampleMode=0`): y-axis maps to element index, x-axis to time.
Scatterer mode (`sampleMode=1`): renders a line plot via SDF in the postprocess pass.

## Beam Profile Pipeline

**Init**: `initBeamProfile(gl)` -- 4 passes, 3 FBOs, supports stochastic max-amplitude.

- Resolution: `N_BEAM_SAMPLES` (1024) x 256

### Without max-amplitude:
```
calculate(u_stochastic=false) -> FBO main
postprocess(main texture) -> screen
```

### With max-amplitude (up to 200 iterations):
```
calculate(stochastic, seed) -> maxAmplitudeCompare
selectMax(compare vs current) -> main
copyTexture(main) -> maxAmplitudeCurrent
... repeat ...
postprocess(maxAmplitudeCurrent texture) -> screen
```

## Blit Pattern

All pipelines end with `blitToCanvas(gl, visibleCanvas, w, h)`:
1. Sets visible canvas dimensions to match GL output
2. `ctx.drawImage(gl.canvas, 0, 0)` copies the hidden GL canvas

## Overlay Drawing (2D Canvas)

`MainView` has three stacked canvases (bottom to top):
- **Wave geometry canvas**: draws simplified wave propagation geometry (focused/plane/diverging)
- **Simulation canvas**: receives WebGL blit
- **UI canvas**: draws draggable dots (probe corners, virtual source, sample point), sample line

A CSS `Grid` overlay sits on top of all canvases for axis ticks and gridlines.
