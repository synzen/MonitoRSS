import { defineConfig, devices } from "@playwright/test";
import {
  MOCK_RSS_SERVER_PORT,
  MOCK_DISCORD_SERVER_PORT,
  MOCK_SMTP_HTTP_PORT,
  MOCK_REDDIT_SERVER_PORT,
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
  "**/billing/paddle-additional-feeds.spec.ts",
  "**/billing/paddle-workspace-roundtrip.spec.ts",
  "**/billing/paddle-workspace-conversion.spec.ts",
  // Not a checkout test, but it needs a billing-enabled backend (dormant
  // workspaces only exist when Paddle is configured), and e2e-mock.sh blanks
  // the Paddle vars for every non-billing run.
  "**/billing/dormant-workspace-feed-retry.spec.ts",
  // Also not a checkout test: it opens the pricing dialog from the account
  // settings page, which only renders when enableBilling is true (Paddle
  // configured). Without this it runs under e2e-web with Paddle blanked, so the
  // "Manage Subscription" button never appears and the test times out.
  "**/billing/pricing-dialog-focus.spec.ts",
  "**/billing/paddle-workspace-slug-reuse-regression.spec.ts",
];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: resolveWorkers(),
  outputDir: `./test-results${SUFFIX}`,
  // Default per-test ceiling. The genuinely-slow flows (Paddle webhook activation,
  // which can take ~90s) raise this locally with test.setTimeout(); the default
  // stays tight so a broken UI fails in a reasonable window, not minutes.
  timeout: 60_000,
  // Default assertion timeout: a missing/unrendered element fails an expect() in
  // 10s, not at the per-test ceiling. Webhook-gated assertions pass an explicit
  // longer timeout where the wait is legitimately slow.
  expect: { timeout: 10_000 },
  reporter: [
    ["html", { outputFolder: `./playwright-report${SUFFIX}`, open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    // A single action (click/fill/press) that can't find its target fails in 15s
    // instead of hanging until the per-test timeout. This is the fix for failing
    // tests burning minutes waiting on an element that will never appear.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    headless: !!process.env.CI,
    // Backend-issued OAuth redirects (mock Discord login, mock Reddit authorize)
    // point the BROWSER at host.docker.internal so the same base URL also works
    // for containers reaching the host-side mock servers. Docker Desktop adds
    // that hostname to the host's hosts file, but plain Linux (CI runners) does
    // not, so without this the popup dies on chrome-error://chromewebdata/.
    // Resolve it inside the browser ONLY: a host-level /etc/hosts entry is not
    // equivalent, because Docker's embedded DNS forwards container queries to
    // the host resolver, and the backend's mailer resolves via dns.resolve4
    // (bypassing the container's own hosts file) — a host entry of 127.0.0.1
    // leaks into the container and breaks SMTP delivery to the mock mailer.
    launchOptions: {
      args: ["--host-resolver-rules=MAP host.docker.internal 127.0.0.1"],
    },
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
    {
      command: "npx tsx mock-reddit-server.ts",
      port: MOCK_REDDIT_SERVER_PORT,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
