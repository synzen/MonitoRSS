import { defineConfig, devices } from "@playwright/test";
import { MOCK_RSS_SERVER_PORT, AUTH_STATE_PATH } from "./e2e/helpers/constants";

export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/paddle-setup.ts",
  globalTeardown: "./e2e/paddle-teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    storageState: AUTH_STATE_PATH,
    trace: "on-first-retry",
    headless: false,
  },
  webServer: {
    command: "npx tsx e2e/mock-rss-server.ts",
    port: MOCK_RSS_SERVER_PORT,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [
        "**/13-branding-fields.spec.ts",
        "**/14-paddle-checkout.spec.ts",
        "**/15-paddle-branding-checkout.spec.ts",
        "**/16-paddle-retain-cancellation.spec.ts",
      ],
    },
  ],
});
