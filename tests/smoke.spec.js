import { test, expect } from "@playwright/test";

// Helper: wait for app to render. Use waitForTimeout instead of waitForSelector
// because Playwright's stability check conflicts with continuous WebGL rendering
// on SwiftShader (locator resolves to visible but timeout still fires).
async function waitForApp(page) {
  await page.goto("/");
  await page.waitForTimeout(3000);
}

test.describe("Smoke tests", () => {
  test("page loads without console errors", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await waitForApp(page);

    // Allow WebGL warnings (shader compilation, extension requests) but no hard errors
    const realErrors = errors.filter(
      (e) => !e.includes("WebGL") && !e.includes("EXT_")
    );
    expect(realErrors).toEqual([]);
  });

  test("main layout elements exist", async ({ page }) => {
    await waitForApp(page);

    // Simulation container with canvases
    const simContainer = page.locator("#simulationCanvasesContainer");
    await expect(simContainer).toBeVisible();
    const canvases = simContainer.locator("canvas");
    expect(await canvases.count()).toBe(3);

    // Menu
    const menu = page.locator(".menu-container");
    await expect(menu).toBeVisible();

    // Timeline
    const timeline = page.locator("#timelineContainer");
    await expect(timeline).toBeVisible();
  });

  test("menu controls are interactive", async ({ page }) => {
    await waitForApp(page);

    // Check menu sections exist
    const sections = page.locator(".menu-section");
    expect(await sections.count()).toBeGreaterThanOrEqual(5);

    // Check slider controls exist
    const sliders = page.locator(".slidable-control");
    expect(await sliders.count()).toBeGreaterThan(5);

    // Click a menu section title to minimize via JS dispatch.
    // Playwright's click action conflicts with continuous WebGL rendering
    // (stability check + SwiftShader memory pressure on resize).
    await page.evaluate(() => {
      document.querySelector(".menu-section h1").click();
    });
    await expect(sections.first()).toHaveClass(/menu-minimized/);

    // Click again to expand
    await page.evaluate(() => {
      document.querySelector(".menu-section h1").click();
    });
    await expect(sections.first()).not.toHaveClass(/menu-minimized/);
  });

  test("timeline cursor is visible", async ({ page }) => {
    await waitForApp(page);

    const cursor = page.locator(".timeline-time-cursor");
    await expect(cursor).toBeVisible();
  });

  test("grid is visible by default", async ({ page }) => {
    await waitForApp(page);

    // Grid ticks should be rendered
    const gridTicks = page.locator(".grid-tick");
    expect(await gridTicks.count()).toBeGreaterThan(0);
  });

  test("URL state serialization round-trips", async ({ page }) => {
    // Load with a custom state
    const customState = btoa(
      JSON.stringify({
        "center-frequency": 5e6,
        "delay-model": "plane",
      })
    );
    await page.goto(`/?state=${customState}`);
    await page.waitForTimeout(3000);

    // Check the URL still has state param
    const url = page.url();
    expect(url).toContain("state=");

    // Check the select shows "Plane wave"
    const select = page.locator(".control-select select").first();
    await expect(select).toHaveValue("plane");
  });

  test("screenshot at default state", async ({ page }) => {
    await waitForApp(page);
    // Give WebGL an extra moment to render
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "tests/screenshots/default-state.png",
      fullPage: true,
    });
  });
});
