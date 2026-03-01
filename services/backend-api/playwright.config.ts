import { defineConfig, devices } from "@playwright/test";
import { MOCK_RSS_SERVER_PORT, AUTH_STATE_PATH } from "./e2e/helpers/constants";

const PADDLE_TESTS = [
  "**/13-branding-fields.spec.ts",
  "**/14-paddle-checkout.spec.ts",
  "**/15-paddle-branding-checkout.spec.ts",
  "**/16-paddle-retain-cancellation.spec.ts",
];

export default defineConfig({
  testDir: "./e2e/tests",
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
      name: "auth-setup",
      testMatch: "auth.setup.ts",
      use: {},
    },
    {
      name: "paddle-setup",
      testMatch: "paddle.setup.ts",
      dependencies: ["auth-setup"],
      teardown: "paddle-teardown",
      use: {},
    },
    {
      name: "paddle-teardown",
      testMatch: "paddle.teardown.ts",
      use: {},
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["auth-setup"],
      testIgnore: [
        ...PADDLE_TESTS,
        "**/auth.setup.ts",
        "**/paddle.setup.ts",
        "**/paddle.teardown.ts",
      ],
    },
    {
      name: "paddle",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["auth-setup", "paddle-setup"],
      testMatch: PADDLE_TESTS,
    },
  ],
  webServer: {
    command: "npx tsx e2e/mock-rss-server.ts",
    port: MOCK_RSS_SERVER_PORT,
    reuseExistingServer: false,
  },
});
