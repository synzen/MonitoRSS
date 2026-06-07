import { defineConfig, devices } from "@playwright/test";
import {
  MOCK_RSS_SERVER_PORT,
  MOCK_DISCORD_SERVER_PORT,
  MOCK_SMTP_HTTP_PORT,
} from "./helpers/constants";

const INSTANCE = process.env.E2E_INSTANCE || "0";
const SUFFIX = INSTANCE === "0" ? "" : `-${INSTANCE}`;

// Concurrent runs (instance > 0) share one Docker host, so cap workers to ease
// resource contention. E2E_WORKERS overrides for manual tuning.
function resolveWorkers(): number {
  if (process.env.E2E_WORKERS) {
    return Number(process.env.E2E_WORKERS);
  }
  if (process.env.CI) {
    return 4;
  }
  return INSTANCE === "0" ? 8 : 4;
}

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
  retries: 1,
  workers: resolveWorkers(),
  outputDir: `./test-results${SUFFIX}`,
  reporter: [
    ["html", { outputFolder: `./playwright-report${SUFFIX}`, open: "never" }],
  ],
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
  // Mock servers run on the HOST (not in Docker), so their output would otherwise be
  // lost. Each server tees its console to logs/mock-*.log (see helpers/log-to-file.ts)
  // so e2e-mock.sh can fold them into the combined failure log; stdout/stderr are piped
  // so Playwright also surfaces them in its own run output.
  webServer: [
    {
      command: "npx tsx mock-rss-server.ts",
      port: MOCK_RSS_SERVER_PORT,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npx tsx mock-discord-server.ts",
      port: MOCK_DISCORD_SERVER_PORT,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Probed on its HTTP control port; it also opens a raw SMTP socket.
      command: "npx tsx mock-smtp-server.ts",
      port: MOCK_SMTP_HTTP_PORT,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
