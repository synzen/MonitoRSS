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
      // Re-render race; retry.
    }
  }

  await expect(trigger).not.toHaveAttribute("aria-disabled", "true");
}

test.describe("Feed table selection and filtered empty state", () => {
  test("applies a bulk action to manually selected rows across pages and clears all-matching selection", async ({
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
    const prefix = `PageSelection ${Date.now()}`;

    try {
      await seedPersonalFeedsInDb({
        userId,
        discordUserId,
        feeds: Array.from({ length: 60 }, (_, i) => ({
          title: `${prefix} ${String(i).padStart(3, "0")}`,
          url: MOCK_RSS_FEED_URL,
        })),
      });

      await page.goto(`/feeds?search=${encodeURIComponent(prefix)}`);
      await expect(page.getByText("1–50 of 60 feeds").first()).toBeVisible({
        timeout: 15000,
      });

      await page
        .getByRole("checkbox", { name: /Check feed .* for bulk actions/ })
        .first()
        .click({ force: true });

      await page
        .getByRole("navigation", { name: "Feed table pagination (bottom)" })
        .getByRole("button", { name: "Next" })
        .click();
      await expect(page.getByText("51–60 of 60 feeds").first()).toBeVisible();
      await page
        .getByRole("checkbox", { name: /Check feed .* for bulk actions/ })
        .first()
        .click({ force: true });

      await expect(
        page.getByRole("heading", { name: "Feeds (2/60)" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem", { name: "Disable" }).click();
      await expect(page.getByRole("alertdialog")).toContainText(
        "disable 2 feed(s)",
      );
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(
        page
          .getByRole("alert")
          .filter({
            hasText: /Disabled 2 of 2 feeds|Successfully disabled 2 feeds/,
          }),
      ).toBeVisible({ timeout: 30000 });
      await expect(page.getByLabel("Manually disabled").first()).toBeVisible();

      await page
        .getByRole("navigation", { name: "Feed table pagination (bottom)" })
        .getByRole("button", { name: "Previous" })
        .click();
      await expect(page.getByLabel("Manually disabled").first()).toBeVisible();

      await clickSelectAllLoadedCheckbox(page);
      await page
        .getByRole("button", { name: "Select all 60 matching feeds" })
        .click();
      const clearSelectionButton = page.getByRole("button", {
        name: "Clear selection",
      });
      await expect(
        page.getByText("All 60 matching feeds selected."),
      ).toBeVisible();
      await expect(clearSelectionButton).toBeFocused();

      await clearSelectionButton.click();
      await expect(
        page.getByText("All 60 matching feeds selected."),
      ).toHaveCount(0);
      await expect(
        page.getByRole("checkbox", {
          name: "Check all currently loaded feeds for bulk actions",
        }),
      ).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Feed Actions" }),
      ).toHaveAttribute("aria-disabled", "true");
    } finally {
      await deletePersonalFeedsByTitlePrefixInDb({ userId, prefix });
    }
  });

  test("clears the URL search from the empty-state clear-all action", async ({
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
    const prefix = `EmptySearchControl ${Date.now()}`;

    try {
      await seedPersonalFeedsInDb({
        userId,
        discordUserId,
        feeds: [{ title: prefix, url: MOCK_RSS_FEED_URL }],
      });

      await page.goto(
        `/feeds?search=${encodeURIComponent(`NoResults ${Date.now()}`)}`,
      );
      await expect(
        page.getByRole("heading", { name: "No matching feeds" }),
      ).toBeVisible({
        timeout: 15000,
      });

      await page.getByRole("button", { name: "Clear all filters" }).click();

      await expect(page).not.toHaveURL(/search=/);
      await expect(page.getByRole("table")).toBeVisible();
    } finally {
      await deletePersonalFeedsByTitlePrefixInDb({ userId, prefix });
    }
  });
});
