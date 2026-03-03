import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const NEW_URL = "http://localhost:3000";
const ORIGINAL_URL = "http://localhost:3001";
const SCREENSHOT_DIR = "tests/screenshots";

// Ensure screenshot directory exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

/**
 * Compare two screenshots and return the diff metrics.
 */
function compareImages(img1, img2) {
  const png1 = PNG.sync.read(img1);
  const png2 = PNG.sync.read(img2);
  const width = Math.min(png1.width, png2.width);
  const height = Math.min(png1.height, png2.height);
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    png1.data,
    png2.data,
    diff.data,
    width,
    height,
    { threshold: 0.15 }
  );
  const totalPixels = width * height;
  return {
    diffPixels,
    totalPixels,
    diffPercent: (diffPixels / totalPixels) * 100,
    diffPng: PNG.sync.write(diff),
  };
}

/**
 * Open both apps side-by-side and wait for rendering.
 * Accepts either a single stateParam (used for both) or separate newStateParam/origStateParam.
 */
async function openBothApps(browser, stateParam, origStateParam) {
  const [newPage, origPage] = await Promise.all([
    browser.newPage(),
    browser.newPage(),
  ]);

  const newSuffix = stateParam ? `/?state=${stateParam}` : "/";
  const origSuffix = (origStateParam || stateParam) ? `/?state=${origStateParam || stateParam}` : "/";
  await Promise.all([
    newPage.goto(`${NEW_URL}${newSuffix}`),
    origPage.goto(`${ORIGINAL_URL}${origSuffix}`),
  ]);

  // Wait for WebGL rendering to stabilize (SwiftShader is slow)
  await Promise.all([
    newPage.waitForTimeout(5000),
    origPage.waitForTimeout(5000),
  ]);

  return { newPage, origPage };
}

/**
 * Screenshot both pages, compare, save artifacts, and assert.
 */
async function compareAndAssert(newPage, origPage, testName, maxDiffPercent) {
  // Extra settle time for SwiftShader rendering after interaction
  await Promise.all([
    newPage.waitForTimeout(2000),
    origPage.waitForTimeout(2000),
  ]);

  const [newShot, origShot] = await Promise.all([
    newPage.screenshot(),
    origPage.screenshot(),
  ]);

  fs.writeFileSync(path.join(SCREENSHOT_DIR, `new-${testName}.png`), newShot);
  fs.writeFileSync(path.join(SCREENSHOT_DIR, `orig-${testName}.png`), origShot);

  const result = compareImages(newShot, origShot);
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, `diff-${testName}.png`),
    result.diffPng
  );

  console.log(
    `${testName}: ${result.diffPixels}/${result.totalPixels} pixels differ (${result.diffPercent.toFixed(2)}%)`
  );

  expect(result.diffPercent).toBeLessThan(maxDiffPercent);
  return result;
}

/**
 * Perform a mouse drag sequence on an element via page.evaluate + dispatchEvent.
 * Uses coordinate-based dispatching to avoid SwiftShader actionability issues.
 */
async function simulateDrag(page, selector, fromX, fromY, toX, toY, steps = 10) {
  await page.evaluate(
    ({ sel, fx, fy, tx, ty, nSteps }) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Element not found: ${sel}`);
      const rect = el.getBoundingClientRect();

      // Convert from element-relative coords to page coords
      const pageFromX = rect.left + fx;
      const pageFromY = rect.top + fy;
      const pageToX = rect.left + tx;
      const pageToY = rect.top + ty;

      const dispatch = (type, x, y) => {
        el.dispatchEvent(
          new MouseEvent(type, {
            clientX: x,
            clientY: y,
            pageX: x + window.pageXOffset,
            pageY: y + window.pageYOffset,
            bubbles: true,
            cancelable: true,
          })
        );
      };

      dispatch("mousedown", pageFromX, pageFromY);

      for (let i = 1; i <= nSteps; i++) {
        const t = i / nSteps;
        const cx = pageFromX + (pageToX - pageFromX) * t;
        const cy = pageFromY + (pageToY - pageFromY) * t;
        // mousemove is registered on document in the interaction system
        document.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: cx,
            clientY: cy,
            pageX: cx + window.pageXOffset,
            pageY: cy + window.pageYOffset,
            bubbles: true,
            cancelable: true,
          })
        );
      }

      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: pageToX,
          clientY: pageToY,
          pageX: pageToX + window.pageXOffset,
          pageY: pageToY + window.pageYOffset,
          bubbles: true,
          cancelable: true,
        })
      );
    },
    { sel: selector, fx: fromX, fy: fromY, tx: toX, ty: toY, nSteps: steps }
  );
}

/**
 * Simulate a wheel event on an element.
 */
async function simulateWheel(page, selector, deltaX, deltaY, ctrlKey = false) {
  await page.evaluate(
    ({ sel, dx, dy, ctrl }) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Element not found: ${sel}`);
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      el.dispatchEvent(
        new WheelEvent("wheel", {
          clientX: cx,
          clientY: cy,
          deltaX: dx,
          deltaY: dy,
          ctrlKey: ctrl,
          bubbles: true,
          cancelable: true,
        })
      );
    },
    { sel: selector, dx: deltaX, dy: deltaY, ctrl: ctrlKey }
  );
}

// ---- Test suite ----

test.describe("Interaction tests", () => {
  // Generous timeout for SwiftShader
  test.setTimeout(90000);

  test("drag virtual source", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    const simSelector = "#simulationCanvasesContainer";

    // The virtual source is at world coords [0, 0.04] (center-upper area).
    // With default camera (scale=0.08, pos=[0,-0.01]) and viewport 1280x720,
    // the simulation container takes roughly the left ~70% of the viewport.
    // We need to find where the virtual source appears on screen.
    // Rather than computing the exact matrix, we can get the container size
    // and approximate: the virtual source is near the center horizontally
    // and in the upper portion vertically.
    //
    // Approach: get the container dimensions, then drag from approximate
    // center-upper area downward and to the right.

    for (const page of [newPage, origPage]) {
      const box = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return { width: el.offsetWidth, height: el.offsetHeight };
      }, simSelector);

      // Virtual source is roughly at center-x, ~35-40% from top
      const fromX = box.width * 0.5;
      const fromY = box.height * 0.35;
      // Drag it down and to the right
      const toX = box.width * 0.6;
      const toY = box.height * 0.55;

      await simulateDrag(page, simSelector, fromX, fromY, toX, toY, 15);
    }

    await compareAndAssert(newPage, origPage, "drag-virtual-source", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("drag probe corner", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    const simSelector = "#simulationCanvasesContainer";

    // The probe is at y=0, spanning roughly x=-10mm to x=+10mm.
    // With the default camera, the probe endpoints (blue dots) appear
    // near the bottom-center of the simulation view.
    // corner-1 is at the left end, corner-2 at the right end.

    for (const page of [newPage, origPage]) {
      const box = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return { width: el.offsetWidth, height: el.offsetHeight };
      }, simSelector);

      // Right probe corner is roughly at center-x + some offset, near bottom
      // With default camera the probe sits at roughly 65% from top
      const fromX = box.width * 0.57;
      const fromY = box.height * 0.62;
      // Drag corner to the right to widen the probe
      const toX = box.width * 0.7;
      const toY = box.height * 0.62;

      await simulateDrag(page, simSelector, fromX, fromY, toX, toY, 15);
    }

    await compareAndAssert(newPage, origPage, "drag-probe-corner", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("zoom with ctrl+wheel", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    const simSelector = "#simulationCanvasesContainer";

    // Zoom in using ctrl+wheel (deltaY negative = zoom in)
    for (const page of [newPage, origPage]) {
      // Multiple small wheel events to zoom in
      for (let i = 0; i < 5; i++) {
        await simulateWheel(page, simSelector, 0, -50, true);
        await page.waitForTimeout(100);
      }
    }

    await compareAndAssert(newPage, origPage, "zoom-ctrl-wheel", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("pan with wheel (no ctrl)", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    const simSelector = "#simulationCanvasesContainer";

    // Pan by sending wheel events without ctrl key
    for (const page of [newPage, origPage]) {
      for (let i = 0; i < 5; i++) {
        await simulateWheel(page, simSelector, 80, 40, false);
        await page.waitForTimeout(100);
      }
    }

    await compareAndAssert(newPage, origPage, "pan-wheel", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("click timeline to move cursor", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    const timelineSelector = "#timelineContainer";

    // Click at roughly 70% along the timeline to move the time cursor.
    // Use Playwright's native mouse API (page.mouse.click) which generates
    // real browser-level pointer events. Synthetic PointerEvent dispatch
    // doesn't trigger the original ClojureScript app's Replicant event system.
    for (const page of [newPage, origPage]) {
      const box = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Element not found: ${sel}`);
        const rect = el.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }, timelineSelector);

      const clickX = box.left + box.width * 0.7;
      const clickY = box.top + box.height * 0.5;

      await page.mouse.click(clickX, clickY);
    }

    await compareAndAssert(newPage, origPage, "click-timeline", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("change delay model to plane wave", async ({ browser }) => {
    // New app uses camelCase keys, original uses kebab-case
    const newParam = btoa(JSON.stringify({ delayModel: "plane" }));
    const origParam = btoa(JSON.stringify({ "delay-model": "plane" }));
    const { newPage, origPage } = await openBothApps(browser, newParam, origParam);

    await compareAndAssert(newPage, origPage, "delay-model-plane", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("change delay model to diverging wave", async ({ browser }) => {
    const newParam = btoa(JSON.stringify({ delayModel: "diverging" }));
    const origParam = btoa(JSON.stringify({ "delay-model": "diverging" }));
    const { newPage, origPage } = await openBothApps(browser, newParam, origParam);

    await compareAndAssert(newPage, origPage, "delay-model-diverging", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("switch to display envelope mode", async ({ browser }) => {
    const newParam = btoa(JSON.stringify({ displayMode: "envelope" }));
    const origParam = btoa(JSON.stringify({ "display-mode": "envelope" }));
    const { newPage, origPage } = await openBothApps(browser, newParam, origParam);

    await compareAndAssert(newPage, origPage, "display-envelope", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("switch to display intensity mode", async ({ browser }) => {
    const newParam = btoa(JSON.stringify({ displayMode: "intensity" }));
    const origParam = btoa(JSON.stringify({ "display-mode": "intensity" }));
    const { newPage, origPage } = await openBothApps(browser, newParam, origParam);

    await compareAndAssert(newPage, origPage, "display-intensity", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("change delay model via select control", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    // Change the delay model select to "plane" via DOM manipulation
    for (const page of [newPage, origPage]) {
      await page.evaluate(() => {
        const selects = document.querySelectorAll(".control-select select");
        // The first select in the menu is the delay model
        const delaySelect = selects[0];
        if (!delaySelect) throw new Error("Delay model select not found");
        delaySelect.value = "plane";
        delaySelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    // Wait for simulation to update
    await Promise.all([
      newPage.waitForTimeout(3000),
      origPage.waitForTimeout(3000),
    ]);

    await compareAndAssert(newPage, origPage, "select-delay-model", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("toggle display mode via select control", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    // Change the display mode select to "envelope"
    for (const page of [newPage, origPage]) {
      await page.evaluate(() => {
        const selects = document.querySelectorAll(".control-select select");
        // The display mode select is the second select in the menu
        const displaySelect = selects[1];
        if (!displaySelect) throw new Error("Display mode select not found");
        displaySelect.value = "envelope";
        displaySelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    await Promise.all([
      newPage.waitForTimeout(3000),
      origPage.waitForTimeout(3000),
    ]);

    await compareAndAssert(newPage, origPage, "select-display-mode", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("combined: zoom then pan", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    const simSelector = "#simulationCanvasesContainer";

    // First zoom in
    for (const page of [newPage, origPage]) {
      for (let i = 0; i < 3; i++) {
        await simulateWheel(page, simSelector, 0, -40, true);
        await page.waitForTimeout(100);
      }
    }

    await Promise.all([
      newPage.waitForTimeout(1000),
      origPage.waitForTimeout(1000),
    ]);

    // Then pan
    for (const page of [newPage, origPage]) {
      for (let i = 0; i < 4; i++) {
        await simulateWheel(page, simSelector, 60, 30, false);
        await page.waitForTimeout(100);
      }
    }

    await compareAndAssert(newPage, origPage, "zoom-then-pan", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("drag on empty space (camera pan via drag)", async ({ browser }) => {
    const { newPage, origPage } = await openBothApps(browser);

    const simSelector = "#simulationCanvasesContainer";

    // Drag on an area away from any draggable point to pan the camera.
    // The bottom-left quadrant of the simulation view should be empty space.
    for (const page of [newPage, origPage]) {
      const box = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return { width: el.offsetWidth, height: el.offsetHeight };
      }, simSelector);

      // Bottom-left area, away from draggable points
      const fromX = box.width * 0.15;
      const fromY = box.height * 0.85;
      const toX = box.width * 0.35;
      const toY = box.height * 0.65;

      await simulateDrag(page, simSelector, fromX, fromY, toX, toY, 15);
    }

    // Note: The main interaction system doesn't pan on empty-space drag
    // (it only drags points or does nothing). Camera pan is via wheel events.
    // So this test verifies that dragging on empty space does NOT change the view,
    // and both apps behave the same way.
    await compareAndAssert(newPage, origPage, "drag-empty-space", 15);
    await Promise.all([newPage.close(), origPage.close()]);
  });
});
