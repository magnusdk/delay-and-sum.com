import { test, expect } from "@playwright/test";
import { waitForMount } from "./helpers.js";

const encode = (obj) => btoa(JSON.stringify(obj));

// A state param whose values have the wrong type must not be able to wedge the
// app -- the tick-interval search in the timeline loops until it finds an
// interval >= the computed one, which never terminates for NaN.
test("malformed URL state is ignored without hanging the page", async ({ page }) => {
  await waitForMount(
    page,
    `/?state=${encode({ timelineLength: "x", delayModel: "plane", centerFrequency: 5e6 })}`
  );

  // Reaching here at all proves the main thread is not wedged.
  const ticks = await page.locator("#timelineContainer .grid-tick").count();
  expect(ticks).toBeGreaterThan(0);

  // The bad value fell back to its default; the valid ones still applied.
  await expect(page.locator(".control-select select").first()).toHaveValue("plane");
});

test("well-formed state still round-trips", async ({ page }) => {
  await waitForMount(
    page,
    `/?state=${encode({ delayModel: "diverging", timelineLength: 5e-5 })}`
  );

  await expect(page.locator(".control-select select").first()).toHaveValue("diverging");
  expect(await page.locator("#timelineContainer .grid-tick").count()).toBeGreaterThan(0);
});
