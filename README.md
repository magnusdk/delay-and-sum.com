# delay-and-sum.com

*This branch is an LLM-assisted rewrite of the original ClojureScript implementation
into JavaScript.*

An interactive ultrasound beamforming simulator that runs entirely in the browser.
Move the probe, focus, and sample point around and watch the transmitted wavefield
respond in real time.

**Live at [delay-and-sum.com](https://delay-and-sum.com)**

## What it does

The acoustic field is simulated on the GPU from the contributions of every individual
transducer element, so the picture reacts immediately as you drag things around.

- **Three transmit models** — focused, plane, and diverging waves
- **Field display modes** — phase, envelope, and intensity; per-element time delays
  becomes available once "Show maximum amplitude" is enabled
- **Timeline** — scrub through time; view the raw channel data or the signal at a
  chosen sample point
- **Beam profiles** — lateral and axial plots, sampled live along the beam
- **Adjustable probe** — element count, array width, element width, aperture
  orientation, and Tukey apodization
- **Shareable links** — the full parameter set is encoded into the URL as you work,
  so copying the address bar shares exactly what you see

Requires a browser with WebGL2.

## Running it locally

```bash
npm install
npm run dev      # dev server on http://localhost:3000
npm run build    # production build -> dist/
```

## Tests

Playwright end-to-end tests, run against headless Chromium with SwiftShader:

```bash
npx playwright install chromium   # once
npm test                          # all suites
npx playwright test tests/smoke.spec.js
```

`interaction.spec.js` and `visual-regression.spec.js` compare this app side by side
with a reference build on port 3001, and will fail unless one is running there. The
remaining suites are self-contained.

## Further reading

Both are written for coding agents working on this repo rather than for end users:

- [`AGENTS.md`](AGENTS.md) — orientation guide, file-by-file map, common tasks
- [`docs/`](docs/) — deep dives on architecture, rendering, shaders, coordinates,
  state, interaction, and the menu

## Credits

Developed at and funded by [NTNU](https://www.ntnu.edu/). Presented as a poster at
IUS 2024 — [poster PDF](https://delay-and-sum.com/poster_delay_and_sum_com.pdf).

Bug reports and suggestions are welcome via
[GitHub issues](https://github.com/magnusdk/delay-and-sum.com/issues/new).
