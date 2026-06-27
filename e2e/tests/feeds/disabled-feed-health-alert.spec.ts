import { test, expect } from "../../fixtures/test-fixtures";
import {
  createFeed,
  deleteFeed,
  bulkDisableFeeds,
  generateTestId,
} from "../../helpers/api";
import {
  mockRssFlakyFeedUrl,
  mockRssFlakyFeedFailUrl,
} from "../../helpers/constants";

// A disabled feed is not polled, so the "Requests are currently failing" health alert
// (and its retry CTA) must not render alongside the disabled alert — the disabled
// alert is the sole banner explaining the feed's state.
test.describe("Disabled feed health alert suppression", () => {
  test("hides the failing-requests alert once the feed is disabled", async ({
    page,
  }) => {
    const key = generateTestId();
    let feedId: string | undefined;

    try {
      // The flaky URL validates healthy at creation, then every later fetch fails.
      const feed = await createFeed(page, {
        url: mockRssFlakyFeedUrl(key),
        title: `Health Alert Feed ${key}`,
      });
      feedId = feed.id;

      await page.request.post(mockRssFlakyFeedFailUrl(key));

      // Record one failing attempt (same endpoint the UI's retry button uses), so the
      // feed's latest request is a failure.
      const manualRequest = await page.request.post(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
      );
      expect(manualRequest.ok()).toBeTruthy();

      // Positive control: while the feed is ENABLED, the health alert shows.
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
      await page.getByRole("link", { name: feed.title, exact: true }).click();
      await expect(
        page.getByText("Requests are currently failing"),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("button", { name: "Retry feed request" }),
      ).toBeVisible();

      // Disable the feed (API setup; the UI disable flow is covered by
      // bulk-toggle-feeds.spec.ts) and revisit its page the way a user would.
      await bulkDisableFeeds(page, [feed.id]);
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
      await expect(
        page
          .getByRole("row")
          .filter({
            has: page.getByRole("link", { name: feed.title, exact: true }),
          })
          .getByLabel("Manually disabled"),
      ).toBeVisible({ timeout: 10000 });
      await page.getByRole("link", { name: feed.title, exact: true }).click();

      // The disabled alert is the only banner; the health alert and retry CTA are gone.
      await expect(
        page.getByText("This feed has been manually disabled"),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText("Requests are currently failing"),
      ).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: "Retry feed request" }),
      ).not.toBeVisible();
    } finally {
      if (feedId) {
        await deleteFeed(page, feedId).catch(() => {});
      }
    }
  });
});
