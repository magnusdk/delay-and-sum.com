import { test, expect } from "@playwright/test";
import { waitForMount, PLOT_CANVAS } from "./helpers.js";

// The stochastic max-amplitude accumulator runs a fixed ~200 iterations.
// Waiting it out is cheaper than polling for exact pixel stability.
const CONVERGE_MS = 6000;

// Signature of the plotted curve: for each sampled column, how many pixels tall
// the filled (blue) region is. Captures the shape of the profile, not just noise.
async function profileSignature(page) {
  return page.evaluate((sel) => {
    const canvas = document.querySelector(sel);
    const { data, width, height } = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);
    const COLUMNS = 64;
    const sig = [];
    for (let c = 0; c < COLUMNS; c++) {
      const x = Math.floor(((c + 0.5) / COLUMNS) * width);
      let filled = 0;
      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4;
        if (data[i + 2] > data[i] + 20) filled++;
      }
      sig.push(filled / height);
    }
    return sig;
  }, PLOT_CANVAS);
}

const fractionWhere = (a, b, pred) =>
  a.filter((_, i) => pred(a[i], b[i])).length / a.length;

// Click the timeline at a fraction of its width, moving `state.time`. This moves
// the sample line along the beam, so the profile must follow.
async function clickTimelineAt(page, fraction) {
  const box = await page.evaluate(() => {
    const r = document.querySelector("#timelineContainer").getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
}

for (const plotType of ["lateral-beam-profile", "axial-beam-profile"]) {
  test(`${plotType} updates after state changes post-convergence @slow`, async ({ page }) => {
    await waitForMount(page, `/?state=${btoa(JSON.stringify({ plotType }))}`);
    await expect(page.locator(".plot-container")).toBeVisible();
    await page.waitForTimeout(CONVERGE_MS);

    const before = await profileSignature(page);
    expect(before.some((v) => v > 0.01)).toBe(true);

    // Move the wavefront to a later time, i.e. a deeper and weaker part of the
    // beam. The profile must follow it down.
    await clickTimelineAt(page, 0.75);
    await page.waitForTimeout(CONVERGE_MS);
    const after = await profileSignature(page);

    expect(fractionWhere(before, after, (x, y) => Math.abs(x - y) > 0.02)).toBeGreaterThan(0.15);
    // The accumulator holds a running maximum, so without a reset on state
    // change no column could ever shrink. This is the sharp check for that.
    expect(fractionWhere(before, after, (x, y) => x - y > 0.02)).toBeGreaterThan(0.15);
  });
}
