import { test, expect } from "@playwright/test";

const encode = (obj) => btoa(JSON.stringify(obj));

// A state param whose values have the wrong type must not be able to wedge the
// app -- the tick-interval search in the timeline loops until it finds an
// interval >= the computed one, which never terminates for NaN.
test.describe("URL state robustness", () => {
  test("malformed timelineLength does not hang the page", async ({ page }) => {
    await page.goto(`/?state=${encode({ timelineLength: "x" })}`);

    // If the main thread is wedged this cannot run at all.
    await expect(page.locator("#timelineContainer")).toBeVisible({ timeout: 10000 });
    const ticks = await page.evaluate(
      () => document.querySelectorAll("#timelineContainer .grid-tick").length,
      { timeout: 8000 }
    );
    // Falls back to the default, so ticks still render.
    expect(ticks).toBeGreaterThan(0);
  });

  test("out-of-shape values are ignored, valid ones still load", async ({ page }) => {
    await page.goto(
      `/?state=${encode({ timelineLength: "x", delayModel: "plane", centerFrequency: 5e6 })}`
    );
    await page.waitForTimeout(3000);

    const select = page.locator(".control-select select").first();
    await expect(select).toHaveValue("plane");
  });

  test("well-formed state still round-trips", async ({ page }) => {
    await page.goto(`/?state=${encode({ delayModel: "diverging", timelineLength: 5e-5 })}`);
    await page.waitForTimeout(3000);

    const select = page.locator(".control-select select").first();
    await expect(select).toHaveValue("diverging");
    expect(
      await page.evaluate(
        () => document.querySelectorAll("#timelineContainer .grid-tick").length
      )
    ).toBeGreaterThan(0);
  });
});
