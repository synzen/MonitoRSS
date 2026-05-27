import { defineConfig, devices } from "@playwright/test";
import {
  MOCK_RSS_SERVER_PORT,
  MOCK_DISCORD_SERVER_PORT,
} from "./helpers/constants";

const PADDLE_CHECKOUT_TESTS = [
  "**/13b-branding-paddle-overlay.spec.ts",
  "**/14-paddle-checkout.spec.ts",
  "**/15-paddle-branding-checkout.spec.ts",
  "**/16-paddle-retain-cancellation.spec.ts",
];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 4,
  reporter: "html",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    headless: !!process.env.CI,
  },
  projects: [
    {
      name: "paddle-setup",
      testMatch: "paddle.setup.ts",
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
      testIgnore: [
        ...PADDLE_CHECKOUT_TESTS,
        "**/auth.setup.ts",
        "**/mock-auth.setup.ts",
        "**/paddle.setup.ts",
        "**/paddle.teardown.ts",
      ],
    },
    {
      name: "paddle",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["paddle-setup"],
      testMatch: PADDLE_CHECKOUT_TESTS,
    },
  ],
  webServer: [
    {
      command: "npx tsx mock-rss-server.ts",
      port: MOCK_RSS_SERVER_PORT,
      reuseExistingServer: false,
    },
    {
      command: "npx tsx mock-discord-server.ts",
      port: MOCK_DISCORD_SERVER_PORT,
      reuseExistingServer: false,
    },
  ],
});
