import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import * as fc from "fast-check";

const NEW_URL = "http://localhost:3000";
const ORIGINAL_URL = "http://localhost:3001";
const SCREENSHOT_DIR = "tests/screenshots";

// Ensure screenshot directory exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

/**
 * Compare two screenshots and return the number of different pixels.
 * @param {Buffer} img1 - PNG buffer
 * @param {Buffer} img2 - PNG buffer
 * @returns {{ diffPixels: number, totalPixels: number, diffPercent: number }}
 */
function compareImages(img1, img2) {
  const png1 = PNG.sync.read(img1);
  const png2 = PNG.sync.read(img2);

  // Resize to the smaller dimensions if they differ
  const width = Math.min(png1.width, png2.width);
  const height = Math.min(png1.height, png2.height);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    png1.data,
    png2.data,
    diff.data,
    width,
    height,
    { threshold: 0.15 } // Allow slight WebGL floating-point differences
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
 * Generate a random URL state parameter.
 */
function randomStateArbitrary() {
  return fc.record({
    "center-frequency": fc.double({ min: 1e5, max: 1e7 }),
    "pulse-length": fc.double({ min: 0.5, max: 10 }),
    "sound-speed": fc.integer({ min: 500, max: 3000 }),
    "delay-model": fc.constantFrom("focused", "plane", "diverging"),
    "display-mode": fc.constantFrom("phase", "envelope", "intensity"),
    "minimum-db": fc.double({ min: -120, max: -10 }),
    "maximum-db": fc.double({ min: -10, max: 6 }),
    "virtual-source": fc.tuple(
      fc.double({ min: -0.05, max: 0.05 }),
      fc.double({ min: 0.01, max: 0.1 })
    ),
    camera: fc.record({
      scale: fc.double({ min: 0.01, max: 1 }),
      pos: fc.tuple(
        fc.double({ min: -0.1, max: 0.1 }),
        fc.double({ min: -0.1, max: 0.1 })
      ),
    }),
    probe: fc.record({
      "n-elements": fc.integer({ min: 1, max: 256 }),
      "array-width": fc.double({ min: 1e-3, max: 0.05 }),
      "normal-azimuth": fc.double({ min: -180, max: 180 }),
    }),
  });
}

test.describe("Visual regression", () => {
  test("default state matches original", async ({ browser }) => {
    const [newPage, origPage] = await Promise.all([
      browser.newPage(),
      browser.newPage(),
    ]);

    await Promise.all([
      newPage.goto(NEW_URL),
      origPage.goto(ORIGINAL_URL),
    ]);

    // Wait for rendering (use waitForTimeout — waitForSelector conflicts with
    // continuous WebGL rendering on SwiftShader)
    await Promise.all([
      newPage.waitForTimeout(5000),
      origPage.waitForTimeout(5000),
    ]);

    const [newShot, origShot] = await Promise.all([
      newPage.screenshot(),
      origPage.screenshot(),
    ]);

    fs.writeFileSync(path.join(SCREENSHOT_DIR, "new-default.png"), newShot);
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "orig-default.png"), origShot);

    const result = compareImages(newShot, origShot);
    fs.writeFileSync(path.join(SCREENSHOT_DIR, "diff-default.png"), result.diffPng);

    console.log(
      `Default state: ${result.diffPixels}/${result.totalPixels} pixels differ (${result.diffPercent.toFixed(2)}%)`
    );

    // Allow up to 5% difference (WebGL FP variance, font rendering, etc.)
    expect(result.diffPercent).toBeLessThan(5);

    await Promise.all([newPage.close(), origPage.close()]);
  });

  test("random states match original (5 samples)", async ({ browser }) => {
    const samples = fc.sample(randomStateArbitrary(), 5);

    for (let i = 0; i < samples.length; i++) {
      const stateParam = btoa(JSON.stringify(samples[i]));
      const url = `?state=${stateParam}`;

      const [newPage, origPage] = await Promise.all([
        browser.newPage(),
        browser.newPage(),
      ]);

      await Promise.all([
        newPage.goto(`${NEW_URL}/${url}`),
        origPage.goto(`${ORIGINAL_URL}/${url}`),
      ]);

      await Promise.all([
        newPage.waitForTimeout(5000),
        origPage.waitForTimeout(5000),
      ]);

      const [newShot, origShot] = await Promise.all([
        newPage.screenshot(),
        origPage.screenshot(),
      ]);

      fs.writeFileSync(path.join(SCREENSHOT_DIR, `new-random-${i}.png`), newShot);
      fs.writeFileSync(path.join(SCREENSHOT_DIR, `orig-random-${i}.png`), origShot);

      const result = compareImages(newShot, origShot);
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, `diff-random-${i}.png`),
        result.diffPng
      );

      console.log(
        `Random state ${i}: ${result.diffPixels}/${result.totalPixels} pixels differ (${result.diffPercent.toFixed(2)}%)`
      );
      console.log(`  State: ${JSON.stringify(samples[i]).slice(0, 100)}...`);

      // Allow up to 10% for random states (more variance possible)
      expect(result.diffPercent).toBeLessThan(10);

      await Promise.all([newPage.close(), origPage.close()]);
    }
  });
});
