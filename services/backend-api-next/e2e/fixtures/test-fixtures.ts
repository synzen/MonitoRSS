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
import { AUTH_STATE_PATH } from "../helpers/constants";

type TestFixtures = {
  testFeed: Feed;
  testFeedWithConnection: FeedWithConnection;
};

type WorkerFixtures = {
  authenticatedContext: BrowserContext;
  authenticatedPage: Page;
};

async function createAuthenticatedContext(browser: Browser) {
  return browser.newContext({ storageState: AUTH_STATE_PATH });
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
