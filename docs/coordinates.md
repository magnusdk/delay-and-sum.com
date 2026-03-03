# Coordinate Systems

All coordinate math is in `src/simulation.js`. Matrices are row-major 3x3 with row-vector
convention: `[x, y, 1] * M`.

## Transform Chain

```
Screen pixels  -->  Clip [-1,1]  -->  World (meters)
    (DOM)          (GL-style)       (simulation space)
```

### Screen to Clip
`screenToClipMatrix(w, h)` -- maps `[0..w, 0..h]` to `[-1..1, -1..1]` with Y flipped.

### Clip to World
`clipToWorldMatrix(w, h, camera)` -- scales by viewport size / `BASE_PIXELS_PER_METER`,
flips Y, then applies the camera transform (scale + translation).

### Composed Transforms
| Function | Direction |
|----------|-----------|
| `screenToWorldMatrix(w, h, camera)` | screen px -> world meters |
| `worldToScreenMatrix(w, h, camera)` | world meters -> screen px |
| `worldToCanvasMatrix(vw, vh, cw, ch, camera)` | world meters -> canvas px (for overlay drawing) |
| `screenToCanvasMatrix(vw, vh, cw, ch)` | viewport px -> canvas px (DPR scaling) |

### Point / Vector Transforms
- `transformPoint(p, m)` -- transform a point through a 3x3 matrix
- `transformPoints(pts, m)` -- batch transform
- `scaleVector(v, m)` -- transform a direction (no translation)

## Camera Model

Camera is `{ scale: number, pos: [x, y] }` stored in `state.camera`.

- `scale` controls zoom level (smaller = more zoomed in)
- `pos` is the camera translation in world-relative units
- Internally converted to/from a 3x3 matrix via `fromScaleAndPos()` / `toScaleAndPos()`

## Camera Manipulation

| Function | Signature | Description |
|----------|-----------|-------------|
| `zoomCamera` | `(camera, anchor, factor)` | Scale around a world-space anchor point |
| `panCamera` | `(camera, dx, dy)` | Translate camera by delta |
| `transformCamera` | `(camera, matrix)` | Apply arbitrary 3x3 transform |

## BASE_PIXELS_PER_METER

Constant: `1000`. Defines the base mapping between pixels and meters before camera scaling.
At `camera.scale = 1`, 1000 pixels = 1 meter.

## Meters Per Pixel

`metersPerPixel(w, h, camera)` returns the world-space size of one screen pixel.
Used by the grid to choose appropriate tick spacing and by interaction to compute snap resolution.

## Canvas Viewport Scaling

`canvasViewportScaling(vw, vh, cw, ch)` returns `[cw/vw, ch/vh]` -- the ratio between canvas
pixels and CSS pixels. Used to scale overlay dot sizes for DPR-correct rendering.
