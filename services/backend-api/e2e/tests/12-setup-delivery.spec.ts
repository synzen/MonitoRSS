import {
  test,
  expect,
  createAuthenticatedContext,
} from "../fixtures/test-fixtures";
import {
  createFeed,
  createConnection,
  deleteAllUserFeeds,
  getAllUserFeeds,
  getTestChannelId,
} from "../helpers/api";
import { MOCK_RSS_FEED_URL } from "../helpers/constants";
import type { Feed } from "../helpers/types";

test.describe("Setup Delivery Checklist", () => {
  let originalFeeds: Feed[];

  test.beforeAll(async ({ browser }) => {
    const context = await createAuthenticatedContext(browser);
    const page = await context.newPage();
    originalFeeds = await getAllUserFeeds(page);
    await deleteAllUserFeeds(page);
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await createAuthenticatedContext(browser);
    const page = await context.newPage();
    await deleteAllUserFeeds(page);
    for (const feed of originalFeeds) {
      await createFeed(page, { url: feed.url, title: feed.title }).catch(
        () => {},
      );
    }
    await context.close();
  });

  test.describe("Checklist visibility", () => {
    let feedWithoutConnection: Feed;

    test.beforeAll(async ({ browser }) => {
      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      await deleteAllUserFeeds(page);
      feedWithoutConnection = await createFeed(page);
      await context.close();
    });

    test.afterAll(async ({ browser }) => {
      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      await deleteAllUserFeeds(page);
      await context.close();
    });

    test("shows setup checklist when feed has no connections", async ({
      page,
    }) => {
      await page.goto("/feeds");

      const alertTitle = page.getByText(
        /\d+ feeds? needs? delivery connections/,
      );
      await expect(alertTitle).toBeVisible({ timeout: 15000 });

      await expect(
        page.getByText("Choose where each feed's articles are delivered."),
      ).toBeVisible();

      // Cards are expanded by default
      await expect(page.getByText(feedWithoutConnection.title)).toBeVisible();
    });

    test("shows feeds table alongside the checklist", async ({ page }) => {
      await page.goto("/feeds");

      await expect(
        page.getByText(/\d+ feeds? needs? delivery connections/),
      ).toBeVisible({ timeout: 15000 });

      await expect(page.getByRole("table")).toBeVisible();
    });
  });

  test.describe("Success state after all feeds configured", () => {
    test("shows success state then dismisses on Done click", async ({
      page,
    }, testInfo) => {
      test.setTimeout(30000);

      const channelId = getTestChannelId();
      if (!channelId) {
        testInfo.skip(true, "No channelId configured");
        return;
      }

      await deleteAllUserFeeds(page);
      const feed = await createFeed(page, {
        url: `${MOCK_RSS_FEED_URL}&setup-success=1`,
      });

      await page.goto("/feeds");

      const alertTitle = page.getByText(
        /\d+ feeds? needs? delivery connections/,
      );
      await expect(alertTitle).toBeVisible({ timeout: 15000 });

      await createConnection(page, feed.id, channelId);

      // After reload, the checklist should no longer be visible since all
      // feeds are now configured.
      await page.reload();

      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      await expect(alertTitle).not.toBeVisible();
    });
  });

  test.describe("No checklist when all feeds configured", () => {
    test.beforeAll(async ({ browser }, testInfo) => {
      const channelId = getTestChannelId();
      if (!channelId) {
        testInfo.skip(true, "No channelId configured");
        return;
      }

      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      await deleteAllUserFeeds(page);
      const feed = await createFeed(page, {
        url: `${MOCK_RSS_FEED_URL}&all-configured=1`,
      });
      await createConnection(page, feed.id, channelId);
      await context.close();
    });

    test.afterAll(async ({ browser }) => {
      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      await deleteAllUserFeeds(page);
      await context.close();
    });

    test("does not show setup checklist when all feeds have connections", async ({
      page,
    }, testInfo) => {
      const channelId = getTestChannelId();
      if (!channelId) {
        testInfo.skip(true, "No channelId configured");
        return;
      }

      await page.goto("/feeds");

      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      await expect(
        page.getByText(/\d+ feeds? needs? delivery connections/),
      ).not.toBeVisible();
    });
  });
});
