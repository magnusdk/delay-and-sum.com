import { test, expect } from "@playwright/test";

const PLOT_CANVAS = ".plot-container canvas";
const UI_CANVAS = "#simulationCanvasesContainer canvas:nth-of-type(3)";

// Count pixels that are distinctly blue -- the plot fill and the sample-line
// overlay are both blue against otherwise neutral content.
function countBlue([sel, margin]) {
  const canvas = document.querySelector(sel);
  if (!canvas) return -1;
  const { data } = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i + 2] > data[i] + margin) n++;
  }
  return n;
}

const bluePixels = (page, sel, margin = 20) =>
  page.evaluate(countBlue, [sel, margin]);

// Rendering runs on a rAF loop under software GL, so poll for the expected
// condition rather than sleeping a fixed amount -- fixed waits get flaky when
// several workers contend for the GPU.
async function waitForBlue(page, sel, margin, min, max, timeout = 30000) {
  await page.waitForFunction(
    ([s, m, lo, hi]) => {
      const canvas = document.querySelector(s);
      if (!canvas) return false;
      const { data } = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i + 2] > data[i] + m) n++;
      }
      return n >= lo && n <= hi;
    },
    [sel, margin, min, max],
    { timeout, polling: 500 }
  );
}

async function setPlot(page, value) {
  await page.evaluate((v) => {
    const sel = [...document.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "lateral-beam-profile")
    );
    sel.value = v;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

const closePlot = (page) =>
  page.evaluate(() => document.querySelector(".close-button").click());

test.describe("Beam profile open/close lifecycle", () => {
  for (const plotType of ["lateral-beam-profile", "axial-beam-profile"]) {
    test(`${plotType} still renders after close and reopen`, async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("#simulationCanvasesContainer")).toBeVisible();

      await setPlot(page, plotType);
      await waitForBlue(page, PLOT_CANVAS, 20, 1, Infinity);

      await closePlot(page);
      await expect(page.locator(".plot-container")).toHaveCount(0);

      // Reopening the SAME plot type must set up a fresh render loop bound to
      // the new canvas, not keep drawing into the discarded one.
      await setPlot(page, plotType);
      await waitForBlue(page, PLOT_CANVAS, 20, 1, Infinity);
    });
  }

  test("closing the plot removes the sample-line overlay", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#simulationCanvasesContainer")).toBeVisible();
    await page.waitForTimeout(3000);
    const baseline = await bluePixels(page, UI_CANVAS, 40);
    expect(baseline).toBeGreaterThan(0);

    await setPlot(page, "lateral-beam-profile");
    await waitForBlue(page, UI_CANVAS, 40, baseline + 1, Infinity);

    await closePlot(page);
    // Overlay must disappear, i.e. drop back to the pre-open pixel count.
    await waitForBlue(page, UI_CANVAS, 40, 0, Math.round(baseline * 1.02));
  });

  test("toggling plot types does not exhaust WebGL contexts", async ({ page }) => {
    const warnings = [];
    page.on("console", (m) => {
      if (/too many active webgl contexts/i.test(m.text())) warnings.push(m.text());
    });

    await page.goto("/");
    await expect(page.locator("#simulationCanvasesContainer")).toBeVisible();
    await page.waitForTimeout(2000);

    for (let i = 0; i < 24; i++) {
      await setPlot(page, i % 2 === 0 ? "lateral-beam-profile" : "axial-beam-profile");
      await page.waitForTimeout(250);
    }

    // The plot must still render once the churn stops.
    await waitForBlue(page, PLOT_CANVAS, 20, 1, Infinity);
    expect(warnings).toEqual([]);
  });
});
