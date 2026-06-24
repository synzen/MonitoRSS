import {
  test as base,
  expect,
  type Page,
  type Locator,
  type Response,
  type BrowserContext,
  type Browser,
  type TestInfo,
} from "@playwright/test";
import {
  createFeed,
  deleteFeed,
  createConnection,
  getTestChannelId,
} from "../helpers/api";
import type { Feed, FeedWithConnection } from "../helpers/types";
import { createMockSessionToken } from "../helpers/mock-discord-data";

const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://localhost:8000";

let userCounter = 0;

function generateUniqueUserId(): string {
  const base = 900000000000000000n;
  return String(base + BigInt(++userCounter) + BigInt(Date.now() % 1000000));
}

type MockCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
};

async function createMockSessionCookies(
  explicitUserId?: string,
): Promise<MockCookie[]> {
  const userId = explicitUserId ?? generateUniqueUserId();
  const token = createMockSessionToken();
  token.discord.id = userId;
  token.access_token = `mock-token-${userId}`;
  token.discord.email = `e2e-${userId}@example.com`;

  const response = await fetch(`${BACKEND_URL}/__test__/set-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: token }),
  });

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("No Set-Cookie from /__test__/set-session");

  const [nameValue] = setCookie.split(";");
  const [name, ...valueParts] = nameValue.split("=");
  const value = valueParts.join("=");

  return [
    {
      name,
      value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    },
  ];
}

// A timed-out `toBeVisible` on an authenticated page is usually a symptom: the
// real cause (an auth/session failure, an unhandled fetch error) only ever
// reached the browser console, which Playwright does not echo into the report.
// This promotes those signals to test annotations so the next failure is legible
// from the report alone, without downloading and parsing a trace. Attaching at the
// context level covers every page the context opens — including ones created after
// this call — so callers never wire individual pages.
function surfaceBrowserErrors(context: BrowserContext, testInfo: TestInfo): void {
  const note = (kind: string, detail: string) => {
    testInfo.annotations.push({ type: kind, description: detail });
  };

  context.on("console", (msg) => {
    if (msg.type() === "error" && /unauthorized|401|ApiAdapterError/i.test(msg.text())) {
      note("browser-auth-error", msg.text().slice(0, 300));
    }
  });
  context.on("weberror", (err) => note("browser-page-error", err.error().message.slice(0, 300)));
  context.on("response", (res) => {
    const url = res.url();
    if (res.status() === 401 && url.includes("/api/v1/")) {
      note("http-401", `401 on ${url.replace(/^https?:\/\/[^/]+/, "")}`);
    }
  });
}

// Creates a fresh browser context with browser-error surfacing already attached.
// Both the default `page` fixture and any spec that needs its own context (e.g. a
// second logged-out actor) go through this, so error visibility is uniform and no
// call site touches the listener wiring directly.
export async function newInstrumentedContext(
  browser: Browser,
  testInfo: TestInfo,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  surfaceBrowserErrors(context, testInfo);
  return context;
}

type TestFixtures = {
  testFeed: Feed;
  testFeedWithConnection: FeedWithConnection;
};

type WorkerFixtures = {
  authenticatedContext: BrowserContext;
  authenticatedPage: Page;
};

async function createAuthenticatedContext(browser: Browser) {
  const cookies = await createMockSessionCookies();
  const context = await browser.newContext();
  await context.addCookies(cookies);
  return context;
}

// A browser context logged in as a SPECIFIC Discord id, instead of the random
// per-test id the default fixtures use. The admin-access spec needs a stable
// identity that matches BACKEND_API_ADMIN_USER_IDS; pass E2E_ADMIN_DISCORD_ID.
export async function createContextForDiscordUser(
  browser: Browser,
  testInfo: TestInfo,
  discordUserId: string,
): Promise<BrowserContext> {
  const cookies = await createMockSessionCookies(discordUserId);
  const context = await newInstrumentedContext(browser, testInfo);
  await context.addCookies(cookies);
  return context;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  authenticatedContext: [
    async ({ browser }, use) => {
      const context = await createAuthenticatedContext(browser);
      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],

  authenticatedPage: [
    async ({ authenticatedContext }, use) => {
      const page = await authenticatedContext.newPage();
      await use(page);
      await page.close();
    },
    { scope: "worker" },
  ],

  page: async ({ browser }, use, testInfo) => {
    const cookies = await createMockSessionCookies();
    const context = await newInstrumentedContext(browser, testInfo);
    await context.addCookies(cookies);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  testFeed: async ({ page }, use) => {
    const feed = await createFeed(page);
    await use(feed);
    await deleteFeed(page, feed.id).catch(() => {});
  },

  testFeedWithConnection: [
    async ({ page }, use, testInfo) => {
      const channelId = getTestChannelId();
      if (!channelId) {
        testInfo.skip(true, "No channelId configured in e2e/config.json");
        return;
      }

      const feed = await createFeed(page);
      const connection = await createConnection(page, feed.id, channelId);
      await use({ feed, connection });
      await deleteFeed(page, feed.id).catch(() => {});
    },
    { timeout: 30000 },
  ],
});

export { expect, type Page, type Locator, createAuthenticatedContext };

export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
): Promise<Response> {
  return page.waitForResponse((response) => {
    const url = response.url();
    if (typeof urlPattern === "string") {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });
}

export async function getApiJson(page: Page, path: string): Promise<unknown> {
  const response = await page.request.get(path);
  return response.json();
}
