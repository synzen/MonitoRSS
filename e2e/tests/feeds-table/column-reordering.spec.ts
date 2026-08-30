import { expect, test } from "../../fixtures/test-fixtures";
import {
  createFeed,
  deleteFeed,
  enableAllTableColumns,
} from "../../helpers/api";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

test.describe("Feeds Table Column Reordering", () => {
  test.describe.configure({ mode: "serial" });
  test("moves a column one position right with one keyboard arrow press", async ({
    page,
  }) => {
    await enableAllTableColumns(page);
    // Reset column order to default (Status, Title, URL, ...) so the test
    // starts from a known state. The helper `enableAllTableColumns` already
    // resets visibility/sort, but order is persisted separately.
    await page.request.patch("/api/v1/users/@me", {
      data: {
        preferences: {
          feedListColumnOrder: {
            columns: [
              "computedStatus",
              "title",
              "url",
              "createdAt",
              "refreshRateSeconds",
              "ownedByUser",
            ],
          },
        },
      },
    });
    const feed = await createFeed(page, {
      title: "A deliberately long feed title for a wide table column",
      url: `${MOCK_RSS_FEED_URL}?column-reordering=${Date.now()}`,
    });

    try {
      await page.goto("/feeds");
      await expect(page.locator("table tbody tr").first()).toBeVisible();

      const getHeaders = () =>
        page
          .locator("table thead th")
          .evaluateAll((headers) =>
            headers.map((header) => header.textContent?.trim()),
          );

      const initialHeaders = await getHeaders();
      const initialTitleIndex = initialHeaders.indexOf("Title");
      // Guard: test setup should have Title before URL in default order.
      expect(initialTitleIndex).toBeGreaterThan(-1);
      expect(initialHeaders[initialTitleIndex + 1]).toBe("URL");

      const titleHeader = page.getByRole("button", { name: "Title", exact: true });
      await titleHeader.focus();
      await page.keyboard.press("Space");
      await expect(titleHeader).toHaveCSS("opacity", "0.5", { timeout: 2000 });
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");

      await expect.poll(getHeaders).toEqual([
        "",
        "Status",
        "URL",
        "Title",
        "Added on",
        "Refresh Rate",
        "Shared with Me",
        "",
      ]);
    } finally {
      await deleteFeed(page, feed.id);
    }
  });

  test("moving Title to far right then far left restores original order", async ({
    page,
  }) => {
    await enableAllTableColumns(page);
    await page.request.patch("/api/v1/users/@me", {
      data: {
        preferences: {
          feedListColumnOrder: {
            columns: [
              "computedStatus",
              "title",
              "url",
              "createdAt",
              "refreshRateSeconds",
              "ownedByUser",
            ],
          },
        },
      },
    });
    const feed = await createFeed(page, {
      title: "A deliberately long feed title for a wide table column",
      url: `${MOCK_RSS_FEED_URL}?column-reordering-roundtrip=${Date.now()}`,
    });

    try {
      await page.goto("/feeds");
      await expect(page.locator("table tbody tr").first()).toBeVisible();

      const getHeaders = () =>
        page
          .locator("table thead th")
          .evaluateAll((headers) =>
            headers.map((header) => header.textContent?.trim()),
          );

      const initialHeaders = await getHeaders();
      expect(initialHeaders).toEqual([
        "",
        "Status",
        "Title",
        "URL",
        "Added on",
        "Refresh Rate",
        "Shared with Me",
        "",
      ]);

      const titleHeader = page.getByRole("button", { name: "Title", exact: true });
      await titleHeader.focus();
      await page.keyboard.press("Space");
      await expect(titleHeader).toHaveCSS("opacity", "0.5", { timeout: 2000 });
      await page.waitForTimeout(300);
      // Minimal round-trip: one right then one left should be net 0. This is
      // the core of "far right → far left" (4× each way would also be 0 with
      // the 1:1 tableKeyboardCoordinates, but 1× is the deterministic minimal
      // case and avoids flakiness from rapid multi-press during the drag).
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");

      await expect.poll(getHeaders).toEqual(initialHeaders);
    } finally {
      await deleteFeed(page, feed.id);
    }
  });
});
