import { test, expect } from "@playwright/test";
import {
  waitForApp, waitForMount, waitForPixels, pixelCount,
  setPlot, closePlot, PLOT_CANVAS, UI_CANVAS,
} from "./helpers.js";

test("plots still render after being closed and reopened @slow", async ({ page }) => {
  await waitForMount(page);

  // Both types in one page load. Reopening the SAME type must rebuild the
  // render loop against the new canvas rather than the discarded one.
  for (const plotType of ["lateral-beam-profile", "axial-beam-profile"]) {
    await setPlot(page, plotType);
    await waitForPixels(page, PLOT_CANVAS, { min: 1 });

    await closePlot(page);
    await expect(page.locator(".plot-container")).toHaveCount(0);

    await setPlot(page, plotType);
    await waitForPixels(page, PLOT_CANVAS, { min: 1 });
  }
});

test("closing the plot removes the sample-line overlay @slow", async ({ page }) => {
  await waitForApp(page);
  const baseline = await pixelCount(page, UI_CANVAS, "blue", 40);
  expect(baseline).toBeGreaterThan(0);

  await setPlot(page, "lateral-beam-profile");
  await waitForPixels(page, UI_CANVAS, { margin: 40, min: baseline + 1 });

  await closePlot(page);
  // The overlay belongs to the plot, so the count must fall back to baseline.
  await waitForPixels(page, UI_CANVAS, {
    margin: 40, min: 0, max: Math.round(baseline * 1.02),
  });
});

test("toggling plot types does not exhaust WebGL contexts @slow", async ({ page }) => {
  const warnings = [];
  page.on("console", (m) => {
    if (/too many active webgl contexts/i.test(m.text())) warnings.push(m.text());
  });

  await waitForMount(page);

  // Chrome allows ~16 live contexts. Each open allocates one, so without the
  // release on close this many toggles is enough to trip the warning.
  for (let i = 0; i < 20; i++) {
    await setPlot(page, i % 2 === 0 ? "lateral-beam-profile" : "axial-beam-profile");
    await page.waitForTimeout(100);
  }

  await waitForPixels(page, PLOT_CANVAS, { min: 1 });
  expect(warnings).toEqual([]);
});
