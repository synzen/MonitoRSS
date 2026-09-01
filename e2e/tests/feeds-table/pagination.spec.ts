import { test, expect } from "../../fixtures/test-fixtures";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  deletePersonalFeedsByTitlePrefixInDb,
  getUserMongoIdFromDiscordId,
  seedPersonalFeedsInDb,
} from "../../helpers/workspaces-db";

test.describe("Feeds Table Pagination", () => {
  test("opens a feed beyond the first page and restores its page on return", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await expect(
      page.getByRole("button", { name: "Account settings" }),
    ).toBeVisible({
      timeout: 15000,
    });

    const discordUserId = await getDiscordUserIdFromPage(page);
    const userId = await getUserMongoIdFromDiscordId(discordUserId);
    const prefix = `Paged Feed ${Date.now()}`;
    const targetTitle = `${prefix} 000`;

    try {
      await seedPersonalFeedsInDb({
        userId,
        discordUserId,
        feeds: Array.from({ length: 101 }, (_, index) => ({
          title: `${prefix} ${String(index).padStart(3, "0")}`,
          url: MOCK_RSS_FEED_URL,
        })),
      });

      await page.goto(`/feeds?search=${encodeURIComponent(prefix)}`);
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      const topPagination = page.getByRole("navigation", {
        name: "Feed table pagination (top)",
      });
      await expect(topPagination.getByText("1–50 of 101 feeds")).toBeVisible();

      const viewMenuButton = page.getByRole("button", {
        name: "Feed table view: Regular",
      });
      await viewMenuButton.click();
      await page.getByRole("menuitemradio", { name: "Compact rows" }).click();
      await page.waitForTimeout(600);
      await page.reload();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("button", { name: "Feed table view: Compact" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Feed table view: Compact" }).click();
      await page.getByRole("menuitemradio", { name: "Regular rows" }).click();
      await page.waitForTimeout(600);

      await topPagination.getByRole("button", { name: "Next" }).click();
      await expect(topPagination.getByText("51–100 of 101 feeds")).toBeVisible();
      await topPagination.getByRole("button", { name: "Next" }).click();
      await expect(topPagination.getByText("101–101 of 101 feeds")).toBeVisible();

      const feedLink = page.getByRole("link", {
        name: targetTitle,
        exact: true,
      });
      await expect(feedLink).toBeVisible();
      await feedLink.click();
      await expect(
        page.getByRole("heading", { name: targetTitle }),
      ).toBeVisible({ timeout: 15000 });

      await page.goBack();
      await expect(topPagination.getByText("101–101 of 101 feeds")).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByRole("row", { name: new RegExp(targetTitle) }),
      ).toBeVisible();
    } finally {
      await deletePersonalFeedsByTitlePrefixInDb({ userId, prefix });
    }
  });
});
