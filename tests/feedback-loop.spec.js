import { test, expect } from "@playwright/test";

test.describe("WebGL feedback loop", () => {
  test("no feedback loop errors in default state", async ({ page }) => {
    const feedbackErrors = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Feedback loop") || text.includes("GL_INVALID_OPERATION")) {
        feedbackErrors.push(text);
      }
    });

    await page.goto("/");
    await page.waitForTimeout(5000);

    console.log(`Feedback loop errors: ${feedbackErrors.length}`);
    feedbackErrors.forEach((e) => console.log(`  - ${e}`));
    expect(feedbackErrors).toEqual([]);
  });

  test("no feedback loop errors with max amplitude enabled", async ({ page }) => {
    const feedbackErrors = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Feedback loop") || text.includes("GL_INVALID_OPERATION")) {
        feedbackErrors.push(text);
      }
    });

    await page.goto("/");
    await page.waitForTimeout(3000);

    // Enable "Show maximum amplitude" checkbox
    const checkboxes = page.locator(".checkbox-control");
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      const text = await checkboxes.nth(i).textContent();
      if (text.includes("maximum amplitude")) {
        await checkboxes.nth(i).locator("input").click();
        break;
      }
    }

    // Let it run stochastic iterations
    await page.waitForTimeout(5000);

    console.log(`Feedback loop errors: ${feedbackErrors.length}`);
    feedbackErrors.forEach((e) => console.log(`  - ${e}`));
    expect(feedbackErrors).toEqual([]);
  });

  test("no feedback loop after changing parameters", async ({ page }) => {
    test.setTimeout(60000);
    const feedbackErrors = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Feedback loop") || text.includes("GL_INVALID_OPERATION")) {
        feedbackErrors.push(text);
      }
    });

    // Load with custom state
    const customState = btoa(JSON.stringify({
      "virtual-source": [0.00512, 0.04056],
    }));
    await page.goto(`/?state=${customState}`);
    await page.waitForTimeout(3000);

    // Change delay model
    const select = page.locator(".control-select select").first();
    await select.selectOption("plane");
    await page.waitForTimeout(3000);

    // Change back
    await select.selectOption("focused");
    await page.waitForTimeout(3000);

    console.log(`Feedback loop errors: ${feedbackErrors.length}`);
    feedbackErrors.forEach((e) => console.log(`  - ${e}`));
    expect(feedbackErrors).toEqual([]);
  });
});
