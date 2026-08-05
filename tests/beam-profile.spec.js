import { test, expect } from "@playwright/test";

const PLOT_CANVAS = ".plot-container canvas";

// The stochastic max-amplitude accumulator runs a fixed number of iterations
// (~200 frames, i.e. ~3.5s at 60fps). Wait comfortably past that so the plot
// has fully converged before and after each state change.
const CONVERGE_MS = 6000;

async function openWithPlot(page, plotType) {
  const stateParam = btoa(JSON.stringify({ plotType }));
  await page.goto(`/?state=${stateParam}`);
  await page.waitForTimeout(3000);
  await expect(page.locator(".plot-container")).toBeVisible();
  await page.waitForTimeout(CONVERGE_MS);
}

// Signature of the plotted curve: for each sampled column, how many pixels tall
// the filled (blue) region is. Captures the shape of the profile, not just noise.
async function profileSignature(page) {
  return page.evaluate((sel) => {
    const canvas = document.querySelector(sel);
    const ctx = canvas.getContext("2d");
    const { data, width, height } = ctx.getImageData(
      0, 0, canvas.width, canvas.height
    );
    const COLUMNS = 64;
    const sig = [];
    for (let c = 0; c < COLUMNS; c++) {
      const x = Math.floor(((c + 0.5) / COLUMNS) * width);
      let filled = 0;
      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4;
        // Filled region is blue; background is white.
        if (data[i + 2] > data[i] + 20) filled++;
      }
      sig.push(filled / height);
    }
    return sig;
  }, PLOT_CANVAS);
}

// Fraction of columns whose fill height moved by more than 2% of plot height.
function fractionChanged(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 0.02) changed++;
  return changed / a.length;
}

// Fraction of columns that got meaningfully *shorter*. The accumulator holds a
// running maximum, so if it is not reset on state change the curve can only
// ever grow -- no column can shrink. This is the sharp test for that bug.
function fractionDecreased(a, b) {
  let dropped = 0;
  for (let i = 0; i < a.length; i++) if (a[i] - b[i] > 0.02) dropped++;
  return dropped / a.length;
}

// Click the timeline at a given fraction along its width, moving `state.time`.
// This moves the sample line along the beam, so the profile must change.
async function clickTimelineAt(page, fraction) {
  const box = await page.evaluate(() => {
    const el = document.querySelector("#timelineContainer");
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
}

for (const plotType of ["lateral-beam-profile", "axial-beam-profile"]) {
  test.describe(`${plotType}`, () => {
    test("updates after state changes post-convergence", async ({ page }) => {
      await openWithPlot(page, plotType);

      const before = await profileSignature(page);
      // Sanity: the converged plot actually has something drawn on it.
      expect(before.some((v) => v > 0.01)).toBe(true);

      // Move the wavefront to a later time, i.e. a deeper and weaker part of
      // the beam. The profile must follow it down.
      await clickTimelineAt(page, 0.75);
      await page.waitForTimeout(CONVERGE_MS);

      const after = await profileSignature(page);
      expect(fractionChanged(before, after)).toBeGreaterThan(0.15);
      expect(fractionDecreased(before, after)).toBeGreaterThan(0.15);
    });
  });
}
