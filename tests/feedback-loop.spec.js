import { test, expect } from "@playwright/test";
import { waitForApp, waitForRender } from "./helpers.js";

// One page, one error listener, several parameter changes. Previously three
// separate tests reloaded the app to assert the same thing.
test("no WebGL feedback loop errors across parameter changes @slow", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("Feedback loop") || t.includes("GL_INVALID_OPERATION")) errors.push(t);
  });

  await waitForApp(page);

  // Stochastic max-amplitude mode: ping-pong FBOs, the likeliest source of a
  // read-and-write-same-texture bug.
  await page.evaluate(() => {
    const control = [...document.querySelectorAll(".control")].find(
      (el) => el.querySelector("label")?.textContent === "Show maximum amplitude"
    );
    control.querySelector("input[type=checkbox]").click();
  });
  await waitForRender(page);

  const select = page.locator(".control-select select").first();
  for (const model of ["plane", "diverging", "focused"]) {
    await select.selectOption(model);
    await waitForRender(page);
  }

  expect(errors).toEqual([]);
});
