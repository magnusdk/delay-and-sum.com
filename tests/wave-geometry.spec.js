import { test, expect } from "@playwright/test";

// The wave-geometry canvas is the first of the three canvases in the
// simulation container (see MainView: waveCanvas, simCanvas, uiCanvas).
const WAVE_CANVAS = "#simulationCanvasesContainer canvas:nth-of-type(1)";

async function waitForApp(page) {
  await page.goto("/");
  await page.waitForTimeout(3000);
}

// Count non-transparent pixels on the wave-geometry canvas.
async function drawnPixelCount(page) {
  return page.evaluate((sel) => {
    const canvas = document.querySelector(sel);
    const ctx = canvas.getContext("2d");
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++;
    return n;
  }, WAVE_CANVAS);
}

// Toggle the "Show simplified geometry" checkbox. Uses a JS dispatch because
// Playwright's actionability check conflicts with the continuous WebGL loop.
async function setSimplifiedGeometry(page, on) {
  await page.evaluate((want) => {
    const control = [...document.querySelectorAll(".control")].find(
      (el) => el.querySelector("label")?.textContent === "Show simplified geometry"
    );
    const box = control.querySelector("input[type=checkbox]");
    if (box.checked !== want) box.click();
  }, on);
  // Let a few render-loop frames run.
  await page.waitForTimeout(500);
}

test.describe("Simplified geometry toggle", () => {
  test("unchecking clears the wave-geometry canvas", async ({ page }) => {
    await waitForApp(page);

    // Default state has showSimplifiedGeometry=true and delayModel="focused",
    // so the canvas should have geometry drawn on it.
    await setSimplifiedGeometry(page, true);
    expect(await drawnPixelCount(page)).toBeGreaterThan(0);

    await setSimplifiedGeometry(page, false);
    expect(await drawnPixelCount(page)).toBe(0);
  });

  test("re-checking draws the geometry again", async ({ page }) => {
    await waitForApp(page);

    await setSimplifiedGeometry(page, false);
    expect(await drawnPixelCount(page)).toBe(0);

    await setSimplifiedGeometry(page, true);
    expect(await drawnPixelCount(page)).toBeGreaterThan(0);
  });
});
