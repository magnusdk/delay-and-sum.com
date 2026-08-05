import { test, expect } from "@playwright/test";
import { waitForApp, waitForPixels, pixelCount, WAVE_CANVAS } from "./helpers.js";

// Toggle the "Show simplified geometry" checkbox. Uses a JS dispatch because
// Playwright's actionability check conflicts with the continuous WebGL loop.
const setSimplifiedGeometry = (page, want) =>
  page.evaluate((w) => {
    const control = [...document.querySelectorAll(".control")].find(
      (el) => el.querySelector("label")?.textContent === "Show simplified geometry"
    );
    const box = control.querySelector("input[type=checkbox]");
    if (box.checked !== w) box.click();
  }, want);

test("simplified geometry toggle clears and redraws its canvas", async ({ page }) => {
  await waitForApp(page);

  // On by default, so the wave-geometry canvas has content.
  await waitForPixels(page, WAVE_CANVAS, { mode: "opaque", min: 1 });

  // Turning it off must clear the canvas, not just stop drawing to it.
  await setSimplifiedGeometry(page, false);
  await waitForPixels(page, WAVE_CANVAS, { mode: "opaque", min: 0, max: 0 });

  // And turning it back on must repaint -- guards against a fix that only clears.
  await setSimplifiedGeometry(page, true);
  await waitForPixels(page, WAVE_CANVAS, { mode: "opaque", min: 1 });

  expect(await pixelCount(page, WAVE_CANVAS, "opaque")).toBeGreaterThan(0);
});
