# Shaders

All shaders are in `src/shaders/`. Vite imports them as raw strings.

## File List

| File | Type | Purpose |
|------|------|---------|
| `vertex.glsl` | Vertex | Fullscreen quad pass-through (also inlined in `webgl.js` as `FULLSCREEN_VERT`) |
| `common.glsl` | Include | Shared constants, pack/unpack, dB, display kernel |
| `elements.glsl` | Include | Element struct, texture lookup, simulation functions |
| `simulation.frag` | Fragment | Main 2D field simulation (deterministic + stochastic) |
| `postprocess.frag` | Fragment | Colormap: phase/envelope/intensity/time-delays display |
| `utility.frag` | Fragment | Helper ops: clear, copy, copy-MRT, select-max |
| `timeline.frag` | Fragment | Timeline simulation + postprocess (probe and scatterer modes) |
| `beam-profile.frag` | Fragment | Beam profile simulation + postprocess |

## Include Dependency Graph

```
simulation.frag ----> common.glsl
                \---> elements.glsl ----> (requires common.glsl constants)
postprocess.frag ---> common.glsl
utility.frag -------> common.glsl
timeline.frag ------> common.glsl
                \---> elements.glsl
beam-profile.frag --> common.glsl
                \---> elements.glsl
```

Note: `#include` is resolved by Vite's shader import plugin at build time.

## common.glsl Key Functions

- `packVec2ToVec4(v)` / `unpackVec4ToVec2(v)` -- encode 2x float [-1,1] into RGBA8 (16-bit per channel)
- `packFloatToVec4(v)` / `unpackVec4ToFloat(v)` -- encode 1x float [-1,1] into RGBA8 (32-bit)
- `dB(v)` / `invDB(v)` -- decibel conversion
- `rand(seed, p)` -- pseudo-random hash
- `lineSDF(p, a, b)` -- signed distance to line segment
- `displayPhaseKernel(v, displayMode, minDb, maxDb, useDb)` -- maps complex signal to RGBA color

## elements.glsl

Defines `Element` struct and `getElement(index)` to read from the element data texture.
Provides `signalForPointScatter0()` (without scatterer) and `signalForPointScatter1()` (with scatterer).

## Element Data Texture Layout

512-wide x 1-high RGBA32F texture. Each element occupies 2 texels (stride = 8 floats):

| Texel offset | RGBA channels | Content |
|-------------|---------------|---------|
| `i*2 + 0` | R, G, B, A | `pos.x`, `pos.y`, `weight`, `delay` |
| `i*2 + 1` | R, G, B, A | `normalAzimuthRad`, `elementWidth`, unused, unused |

Packed in `packElementTexture()` (`src/simulation.js`). Supports up to 256 elements.

## Uniform Flags for Mode Switching

| Uniform | Shader | Values |
|---------|--------|--------|
| `u_stochastic` | simulation.frag, beam-profile.frag | `false`: deterministic, `true`: random time sampling |
| `u_displayMode` | postprocess.frag, timeline.frag | `0`: phase, `1`: envelope, `2`: intensity, `3`: time-delays |
| `u_operation` | utility.frag | `0`: clear, `1`: copy, `2`: copy-MRT, `3`: select-max |
| `u_sampleMode` | timeline.frag | `0`: probe (per-element), `1`: scatterer (single point) |
| `u_postprocess` | timeline.frag, beam-profile.frag | `false`: simulation, `true`: display postprocess |
| `u_lateralBeamProfile` | beam-profile.frag | `true`: lateral, `false`: axial |
