import { expect } from "@playwright/test";

// Canvas stack inside the simulation container, in DOM order.
export const WAVE_CANVAS = "#simulationCanvasesContainer canvas:nth-of-type(1)";
export const SIM_CANVAS = "#simulationCanvasesContainer canvas:nth-of-type(2)";
export const UI_CANVAS = "#simulationCanvasesContainer canvas:nth-of-type(3)";
export const PLOT_CANVAS = ".plot-container canvas";

// Rendering happens on rAF loops under software GL, whose speed varies with how
// many workers are competing. Everything here polls for the condition the test
// actually depends on -- fixed sleeps are both slower and flakier.

/** Wait for the app shell to mount. Enough for DOM-only assertions. */
export async function waitForMount(page, url = "/") {
  await page.goto(url);
  await expect(page.locator("#simulationCanvasesContainer")).toBeVisible();
  await expect(page.locator(".menu-container")).toBeVisible();
}

/** Count pixels on a canvas matching a predicate over [r,g,b,a]. */
export function countPixels([sel, mode, margin]) {
  const canvas = document.querySelector(sel);
  if (!canvas) return -1;
  const { data } = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (mode === "opaque" ? a > 0 : a > 0 && b > r + margin) n++;
  }
  return n;
}

export const pixelCount = (page, sel, mode = "blue", margin = 20) =>
  page.evaluate(countPixels, [sel, mode, margin]);

/** Wait until a canvas' matching-pixel count lands in [min, max]. */
export async function waitForPixels(page, sel, { mode = "blue", margin = 20, min = 1, max = Infinity, timeout = 30000 } = {}) {
  await page.waitForFunction(
    ([s, m, mg, lo, hi]) => {
      const canvas = document.querySelector(s);
      if (!canvas) return false;
      const { data } = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, b, a] = [data[i], data[i + 2], data[i + 3]];
        if (m === "opaque" ? a > 0 : a > 0 && b > r + mg) n++;
      }
      return n >= lo && n <= hi;
    },
    [sel, mode, margin, min, max],
    { timeout, polling: 250 }
  );
}

/** Wait for the simulation view to have actually drawn a frame. */
export const waitForRender = (page) =>
  waitForPixels(page, SIM_CANVAS, { mode: "opaque", min: 1 });

/** Load the app and wait until the field is on screen. */
export async function waitForApp(page, url = "/") {
  await waitForMount(page, url);
  await waitForRender(page);
}

/** Set the plot type via the menu select. */
export const setPlot = (page, value) =>
  page.evaluate((v) => {
    const sel = [...document.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "lateral-beam-profile")
    );
    sel.value = v;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);

export const closePlot = (page) =>
  page.evaluate(() => document.querySelector(".close-button").click());
