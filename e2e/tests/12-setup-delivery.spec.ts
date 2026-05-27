import { test, expect } from "../fixtures/test-fixtures";
import { createFeed, createConnection, getTestChannelId } from "../helpers/api";
import { MOCK_RSS_FEED_URL } from "../helpers/constants";

test.describe("Setup Delivery Checklist", () => {
  test.describe("Checklist visibility", () => {
    test("shows setup checklist when feed has no connections", async ({
      page,
    }) => {
      const feed = await createFeed(page);

      await page.goto("/feeds");

      const alertTitle = page.getByText(
        /\d+ feeds? needs? delivery connections/,
      );
      await expect(alertTitle).toBeVisible({ timeout: 15000 });

      await expect(
        page.getByText("Choose where each feed's articles are delivered."),
      ).toBeVisible();

      await expect(page.getByText(feed.title).first()).toBeVisible();
    });

    test("shows feeds table alongside the checklist", async ({ page }) => {
      await createFeed(page);

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

      const feed = await createFeed(page, {
        url: `${MOCK_RSS_FEED_URL}&setup-success=1`,
      });

      await page.goto("/feeds");

      const alertTitle = page.getByText(
        /\d+ feeds? needs? delivery connections/,
      );
      await expect(alertTitle).toBeVisible({ timeout: 15000 });

      await createConnection(page, feed.id, channelId);

      await page.reload();

      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      await expect(alertTitle).not.toBeVisible();
    });
  });

  test.describe("No checklist when all feeds configured", () => {
    test("does not show setup checklist when all feeds have connections", async ({
      page,
    }, testInfo) => {
      const channelId = getTestChannelId();
      if (!channelId) {
        testInfo.skip(true, "No channelId configured");
        return;
      }

      const feed = await createFeed(page, {
        url: `${MOCK_RSS_FEED_URL}&all-configured=1`,
      });
      await createConnection(page, feed.id, channelId);

      await page.goto("/feeds");

      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      await expect(
        page.getByText(/\d+ feeds? needs? delivery connections/),
      ).not.toBeVisible();
    });
  });
});
