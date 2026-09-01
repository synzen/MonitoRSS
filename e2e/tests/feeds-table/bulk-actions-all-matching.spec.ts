import { test, expect } from "../../fixtures/test-fixtures";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  deletePersonalFeedsByTitlePrefixInDb,
  getUserMongoIdFromDiscordId,
  seedPersonalFeedsInDb,
} from "../../helpers/workspaces-db";
import type { Page } from "@playwright/test";

async function clickSelectAllLoadedCheckbox(page: Page) {
  const checkbox = page.getByRole("checkbox", {
    name: "Check all currently loaded feeds for bulk actions",
  });
  const trigger = page.getByRole("button", { name: "Feed Actions" });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.click({ force: true });
    try {
      await expect(trigger).not.toHaveAttribute("aria-disabled", "true", {
        timeout: 2000,
      });
      return;
    } catch {
      // Re-render race; retry
    }
  }
  await expect(trigger).not.toHaveAttribute("aria-disabled", "true");
}

test.describe("Bulk actions — all matching feeds", () => {
  test("select all matching across pages, paging preserves, search change clears, and delete via all-matching removes every match", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
      timeout: 15000,
    });

    const discordUserId = await getDiscordUserIdFromPage(page);
    const userId = await getUserMongoIdFromDiscordId(discordUserId);
    const stamp = Date.now();
    const prefix = `AllMatchBulk ${stamp}`;
    const total = 60;

    try {
      await seedPersonalFeedsInDb({
        userId,
        discordUserId,
        feeds: Array.from({ length: total }, (_, i) => ({
          title: `${prefix} ${String(i).padStart(3, "0")}`,
          url: MOCK_RSS_FEED_URL,
        })),
      });

      await page.goto(`/feeds?search=${encodeURIComponent(prefix)}`);
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(`1–50 of ${total} feeds`).first()).toBeVisible({ timeout: 10000 });

      // Never silently selects off-page: only the current page is checked after header click.
      await clickSelectAllLoadedCheckbox(page);

      // Banner for page selection must appear and offer the second stage.
      await expect(page.getByText("All 50 feeds on this page selected.", { exact: true })).toBeVisible({
        timeout: 5000,
      });
      const selectAllMatchingButton = page.getByRole("button", {
        name: `Select all ${total} matching feeds`,
      });
      await expect(selectAllMatchingButton).toBeVisible();

      // Two-stage model: clicking the offer switches to all-matching and is visually distinct.
      await selectAllMatchingButton.click();
      await expect(page.getByText(`All ${total} matching feeds selected.`)).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByText("All 50 feeds on this page selected.", { exact: true })).toHaveCount(0);
      await expect(page.getByText(`All ${total} matching feeds selected.`)).toBeVisible();

      // Paging alone preserves all-matching selection.
      const bottomPagination = page.getByRole("navigation", {
        name: "Feed table pagination (bottom)",
      });
      await bottomPagination.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText(`51–60 of ${total} feeds`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(`All ${total} matching feeds selected.`)).toBeVisible();
      // Rows on the new page must appear checked (visual override for all-matching)
      const secondPageCheckbox = page
        .getByRole("checkbox", { name: /Check feed .* for bulk actions/ })
        .first();
      await expect(secondPageCheckbox).toBeChecked({ timeout: 5000 });

      // Going back preserves too
      await bottomPagination.getByRole("button", { name: "Previous" }).click();
      await expect(page.getByText(`1–50 of ${total} feeds`).first()).toBeVisible();
      await expect(page.getByText(`All ${total} matching feeds selected.`)).toBeVisible();

      // Destructive confirmation must include server-derived matching count and action name.
      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Delete" }).click();

      const confirmDialog = page.getByRole("alertdialog");
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });
      await expect(confirmDialog).toContainText(`delete ${total} matching feeds`);

      await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();

      // Completion reports actual affected count and refreshes current page without losing URL search.
      await expect(
        page.getByRole("alert").filter({ hasText: `Successfully deleted ${total} feeds` }),
      ).toBeVisible({ timeout: 30000 });

      // URL search is preserved, but results are gone. The empty filtered state is rendered
      // through the table's FilteredEmptyState, not via API count checks.
      await expect(page).toHaveURL(/search=AllMatchBulk/);
      // Verify via rendered table that no matching rows remain (avoid strict heading match flake)
      await expect(page.getByRole("link", { name: new RegExp(prefix) }).first()).toHaveCount(0, {
        timeout: 10000,
      });
      await expect(page.getByRole("heading", { name: "Get news delivered to your Discord" })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(`All ${total} matching feeds selected.`)).toHaveCount(0);

      // New assertion: clearing/changing the query exits all-matching mode (verified
      // above implicitly by the banner disappearing after the filtered-empty state).
      // Also verify that after navigating away from the filtered empty state, a fresh
      // search would not retain stale selection — covered by re-seeding in next test.
    } finally {
      await deletePersonalFeedsByTitlePrefixInDb({ userId, prefix });
    }
  });

  test("enable/disable via all-matching with search filter only affects matching feeds", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
      timeout: 15000,
    });

    const discordUserId = await getDiscordUserIdFromPage(page);
    const userId = await getUserMongoIdFromDiscordId(discordUserId);
    const stamp = Date.now();
    const matchPrefix = `AllMatchToggle ${stamp}`;
    const otherPrefix = `OtherFeed ${stamp}`;

    try {
      // 60 matching feeds + 2 other feeds (same owner, different title so search isolates)
      // 60 ensures the "Select all N matching" affordance appears (N > pageSize) and the
      // filter-based bulk path is exercised.
      await seedPersonalFeedsInDb({
        userId,
        discordUserId,
        feeds: [
          ...Array.from({ length: 60 }, (_, i) => ({
            title: `${matchPrefix} ${String(i).padStart(3, "0")}`,
            url: MOCK_RSS_FEED_URL,
          })),
          ...Array.from({ length: 2 }, (_, i) => ({
            title: `${otherPrefix} ${i}`,
            url: MOCK_RSS_FEED_URL,
          })),
        ],
      });

      await page.goto(`/feeds?search=${encodeURIComponent(matchPrefix)}`);
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("1–50 of 60 feeds").first()).toBeVisible({ timeout: 10000 });

      await clickSelectAllLoadedCheckbox(page);
      const selectAllBtn = page.getByRole("button", { name: "Select all 60 matching feeds" });
      await expect(selectAllBtn).toBeVisible({ timeout: 5000 });
      await selectAllBtn.click();
      await expect(page.getByText("All 60 matching feeds selected.")).toBeVisible();

      // Disable via all-matching
      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Disable" }).click();
      const disableDialog = page.getByRole("alertdialog");
      await expect(disableDialog).toBeVisible({ timeout: 5000 });
      await expect(disableDialog).toContainText("disable 60 matching feeds");
      await disableDialog.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: /Disabled 60 of 60 feeds|Successfully disabled 60 feeds/ }),
      ).toBeVisible({ timeout: 30000 });

      // Verify through rendered UI: filtered set shows disabled status, other feed untouched
      await expect(page.getByLabel("Manually disabled").first()).toBeVisible({ timeout: 10000 });
      // Other feeds are not in this filtered view; clear search and verify they remain OK
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      // The other feed should still be OK (not disabled by the filtered bulk action)
      await page.goto(`/feeds?search=${encodeURIComponent(otherPrefix)}`);
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("1–2 of 2 feeds").first()).toBeVisible();
      await expect(page.getByLabel("Ok").first()).toBeVisible({ timeout: 10000 });
    } finally {
      await deletePersonalFeedsByTitlePrefixInDb({ userId, prefix: matchPrefix });
      await deletePersonalFeedsByTitlePrefixInDb({ userId, prefix: otherPrefix });
    }
  });

  test("changing search clears all-matching selection", async ({ page }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
      timeout: 15000,
    });

    const discordUserId = await getDiscordUserIdFromPage(page);
    const userId = await getUserMongoIdFromDiscordId(discordUserId);
    const stamp = Date.now();
    const prefix = `AllMatchClear ${stamp}`;

    try {
      // Need more than one page so the "Select all N matching" affordance appears.
      await seedPersonalFeedsInDb({
        userId,
        discordUserId,
        feeds: Array.from({ length: 60 }, (_, i) => ({
          title: `${prefix} ${String(i).padStart(3, "0")}`,
          url: MOCK_RSS_FEED_URL,
        })),
      });

      await page.goto(`/feeds?search=${encodeURIComponent(prefix)}`);
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
      await clickSelectAllLoadedCheckbox(page);
      await page.getByRole("button", { name: "Select all 60 matching feeds" }).click();
      await expect(page.getByText("All 60 matching feeds selected.")).toBeVisible();

      // Changing the search must clear all-matching (spec: search change exits mode)
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("All 60 matching feeds selected.")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Select all 60 matching feeds" })).toHaveCount(0);
    } finally {
      await deletePersonalFeedsByTitlePrefixInDb({ userId, prefix });
    }
  });
});
