import { defineConfig, devices } from "@playwright/test";
import { MOCK_RSS_SERVER_PORT, AUTH_STATE_PATH } from "./e2e/helpers/constants";

export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    storageState: AUTH_STATE_PATH,
    trace: "on-first-retry",
    headless: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [
        "**/13-branding-fields.spec.ts",
        "**/14-paddle-checkout.spec.ts",
        "**/15-paddle-branding-checkout.spec.ts",
        "**/16-paddle-retain-cancellation.spec.ts",
      ],
    },
  ],
  webServer: {
    command: "npx tsx e2e/mock-rss-server.ts",
    port: MOCK_RSS_SERVER_PORT,
    reuseExistingServer: false,
  },
});
