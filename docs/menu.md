# Menu System

The parameter menu is in `src/components/menu.jsx`.

## MENU_SECTIONS Structure

`MENU_SECTIONS` is an array of section objects, each with:
```js
{ title: string, controls: Control[] }
```

Sections: **Array**, **Transmitted wave**, **Field display options**,
**Timeline display options**, **Plot**, **General**.

Each section renders as a collapsible `<MenuSection>` (click title to toggle).

## Control Types

| Type | Component | Description |
|------|-----------|-------------|
| `"slider"` | `Slider` | Drag-to-adjust numeric input. Horizontal pointer movement changes value by `sensitivity * movementX`. Direct text edit on click. |
| `"select"` | `Select` | Dropdown with `options: [[value, label], ...]` |
| `"checkbox"` | `Checkbox` | Boolean toggle |
| `"custom"` | -- | Arbitrary JSX via `render()` function |

## Control Properties

Common: `signal` (function returning a Preact signal), `path` (nested key path into signal value).

Slider-specific: `magnitude` (scale factor for display), `sensitivity` (drag speed),
`nDecimals`, `min`, `max`, `wrapAround` (for angles), `units` (display suffix).

## Visibility Predicates

Controls can have a `visible: () => boolean` function. If it returns false, the control
is not rendered. Example: plot controls are hidden when `plotType === "no-plot"`.

## Adding a New Control

1. Add signal to `DEFAULTS` in `src/state.js` (if it needs URL persistence)
2. Add an entry to the appropriate section in `MENU_SECTIONS`:
   ```js
   { type: "slider", label: "My Param", signal: () => state.myParam, min: 0, max: 10 }
   ```
3. The generic `renderControl()` function handles instantiation

## Signal Path Access

`getSignalValue(sig, path)` / `setSignalValue(sig, path, val)` handle nested reads/writes.
For example, `signal: () => state.probe, path: ["center", 0]` reads/writes `probe.center[0]`.
`setSignalValue` performs immutable updates (shallow clone at each level).
