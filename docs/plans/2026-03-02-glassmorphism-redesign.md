# UI Redesign: Glassmorphism

## Overview

Restyle the app's chrome (menu, timeline, beam profile, controls) with a glassmorphism aesthetic while preserving the existing simulation rendering, color palette, and all behavior.

## Layout

The structural layout stays the same — simulation+timeline on the left, menu sidebar on the right, beam profile as floating overlay. The key shift: the simulation fills the entire viewport and the menu/timeline become translucent frosted layers on top of it.

```
+--------------------------------------------------+
|                                       +---------+|
|   [Full-bleed WebGL simulation]       | Menu    ||
|   (fills entire viewport)             | (frost) ||
|                                       |         ||
|                                       |         ||
|                                       |         ||
|  +--------------------------------------+       ||
|  | Timeline (frosted bar, bottom)       |       ||
|  +--------------------------------------+-------+|
+--------------------------------------------------+
```

## Design Tokens

### Colors (preserved from original)
- `--dark-blue: #1d5199`
- `--blue: #0085ff`
- `--cyan: #00f0ff`
- `--pink: #ff195e`
- `--light-pink: #ffc2d5`

### New glass tokens
- `--glass-bg: rgba(10, 14, 26, 0.75)`
- `--glass-border: rgba(255, 255, 255, 0.1)`
- `--glass-blur: blur(16px)`
- `--glass-text: rgba(255, 255, 255, 0.9)`
- `--glass-text-muted: rgba(255, 255, 255, 0.5)`
- `--glass-hover: rgba(255, 255, 255, 0.08)`
- `--glass-radius: 8px`

### Typography
- Font: Inter (Google Fonts)
- Base size: 13px
- Section headers: 14px, 500 weight, uppercase tracking

## Component Changes

### Menu sidebar
- `backdrop-filter: blur(16px)`, `background: var(--glass-bg)`
- Subtle `1px` border-left with `var(--glass-border)`
- Section headers: no more solid blue bars. Use subtle text dividers with a thin `rgba(255,255,255,0.1)` bottom border
- All text becomes light (white/off-white)
- Width stays ~220px

### Controls
- **Sliders**: Custom drag-to-adjust stays, but styled with glass input fields — dark translucent background, light text, subtle border on focus (cyan glow)
- **Selects**: Replace native `<select>` with styled version — dark bg, light text, cyan border on focus
- **Checkboxes**: Replace with pill toggle switches — cyan when on, dark when off
- **Buttons**: Frosted glass with cyan accent border, subtle hover glow
- **Inputs**: Dark translucent bg, light text, no visible border until focus

### Timeline
- Same position (below simulation)
- Frosted glass background with rounded corners and slight margin
- Time cursor stays pink
- Tick labels become light text

### Beam profile overlay
- Same floating behavior
- Gets frosted glass treatment matching the menu
- Close button gets glass styling

### Grid ticks
- Stay as-is (already light overlays on the simulation)

### Mobile
- Menu slides in as frosted drawer from right (same behavior as current, just restyled)
- Mobile menu button gets glass styling

## What Does NOT Change
- WebGL simulation rendering (shaders, colors, behavior)
- Timeline WebGL rendering
- Canvas overlay drawings (wave geometry, dots, probes)
- State management and interaction logic
- Component structure and hierarchy
- URL state sync

## Files to Modify
- `src/style.css` — complete restyle
- `src/components/menu.jsx` — toggle switches, styled selects, glass section headers
- `src/components/timeline.jsx` — glass container styling
- `src/components/beam-profile.jsx` — glass container styling
- `src/components/grid.jsx` — light text for ticks
- `src/app.jsx` — layout change (simulation behind everything)
- `index.html` — add Inter font link
