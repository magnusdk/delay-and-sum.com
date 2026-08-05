import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 1,
  workers: 2,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: ["--no-sandbox", "--use-gl=swiftshader"],
    },
  },
  webServer: {
    command: "npx vite --port 3000",
    port: 3000,
    reuseExistingServer: true,
    // Generous: a cold Vite start on a fresh clone has to compile on first hit.
    timeout: 60000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
