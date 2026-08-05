import { test, expect } from "@playwright/test";
import { waitForApp } from "./helpers.js";

// One page load covering the things that break loudly. Each load costs several
// seconds under SwiftShader, so this deliberately asserts a lot at once rather
// than splitting into many small tests.
test("app loads, renders, and responds without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await waitForApp(page);

  // Layout
  const simContainer = page.locator("#simulationCanvasesContainer");
  expect(await simContainer.locator("canvas").count()).toBe(3);
  await expect(page.locator("#timelineContainer")).toBeVisible();
  await expect(page.locator(".timeline-time-cursor")).toBeVisible();
  expect(await page.locator(".grid-tick").count()).toBeGreaterThan(0);

  // Controls
  const sections = page.locator(".menu-section");
  expect(await sections.count()).toBeGreaterThanOrEqual(5);
  expect(await page.locator(".slidable-control").count()).toBeGreaterThan(5);

  // Menu collapse/expand. Clicked via JS dispatch: Playwright's actionability
  // check conflicts with the continuous WebGL render loop under SwiftShader.
  const toggle = () =>
    page.evaluate(() => document.querySelector(".menu-section h1").click());
  await toggle();
  await expect(sections.first()).toHaveClass(/menu-minimized/);
  await toggle();
  await expect(sections.first()).not.toHaveClass(/menu-minimized/);

  // Allow WebGL warnings (shader compilation, extension requests) but no hard errors
  const realErrors = errors.filter((e) => !e.includes("WebGL") && !e.includes("EXT_"));
  expect(realErrors).toEqual([]);
});
