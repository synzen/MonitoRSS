import {
  test as base,
  expect,
  type Page,
  type Locator,
  type Response,
  type BrowserContext,
  type Browser,
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

async function createMockSessionCookies(): Promise<MockCookie[]> {
  const userId = generateUniqueUserId();
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

  page: async ({ browser }, use) => {
    const cookies = await createMockSessionCookies();
    const context = await browser.newContext();
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
