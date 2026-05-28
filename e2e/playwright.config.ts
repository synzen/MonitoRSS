import { defineConfig, devices } from "@playwright/test";
import {
  MOCK_RSS_SERVER_PORT,
  MOCK_DISCORD_SERVER_PORT,
} from "./helpers/constants";

const PADDLE_CHECKOUT_TESTS = [
  "**/billing/branding-paddle-overlay.spec.ts",
  "**/billing/paddle-checkout.spec.ts",
  "**/billing/paddle-branding-checkout.spec.ts",
  "**/billing/paddle-retain-cancellation.spec.ts",
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
      name: "e2e-paddle-setup",
      testMatch: "**/billing/paddle.setup.ts",
      teardown: "e2e-paddle-teardown",
      use: {},
    },
    {
      name: "e2e-paddle-teardown",
      testMatch: "**/billing/paddle.teardown.ts",
      use: {},
    },
    {
      name: "e2e-web",
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
      name: "e2e-paddle",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["e2e-paddle-setup"],
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
