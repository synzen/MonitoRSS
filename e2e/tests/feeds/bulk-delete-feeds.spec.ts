import { test, expect } from "../../fixtures/test-fixtures";
import { createFeed, deleteFeed } from "../../helpers/api";
import type { Feed } from "../../helpers/types";
import type { Page } from "@playwright/test";

// Chakra v3 renders a visual control element over the checkbox input that
// intercepts pointer events, so a plain click lands on the wrong layer.
// scrollIntoView + force is the established idiom (see feed-settings.spec.ts).
async function clickFeedCheckbox(page: Page, feedTitle: string) {
  const checkbox = page.getByRole("checkbox", {
    name: `Check feed ${feedTitle} for bulk actions`,
  });
  await checkbox.scrollIntoViewIfNeeded();
  await checkbox.click({ force: true });
}

test.describe("Bulk Delete Feeds", () => {
  test("can bulk delete selected feeds through the UI", async ({ page }) => {
    const feeds: Feed[] = [];

    try {
      // Create three feeds so one survives deletion (avoids the empty-state discovery mode).
      feeds.push(
        await createFeed(page, { title: `Bulk Delete A ${Date.now()}` }),
      );
      feeds.push(
        await createFeed(page, { title: `Bulk Delete B ${Date.now()}` }),
      );
      feeds.push(
        await createFeed(page, { title: `Bulk Delete C ${Date.now()}` }),
      );

      const [feedA, feedB, feedC] = feeds;

      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      // Select the two feeds to delete.
      await clickFeedCheckbox(page, feedA.title);
      await clickFeedCheckbox(page, feedB.title);

      // Open the Feed Actions menu and choose Delete.
      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Delete" }).click();

      // Regression: the confirmation dialog must remain open after the menu closes.
      const confirmDialog = page.getByRole("alertdialog");
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });
      await expect(confirmDialog).toContainText("delete 2 feed(s)");

      // It must still be open a moment later (the bug closed it on the next frame).
      await expect(confirmDialog).toBeVisible();

      await confirmDialog
        .getByRole("button", { name: "Delete", exact: true })
        .click();

      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Successfully deleted feeds" }),
      ).toBeVisible({ timeout: 30000 });

      // Deleted feeds are gone from the table; the untouched feed remains.
      // Use exact match: a feed's row also has a "Configure <title>" link whose
      // accessible name contains the title, so a non-exact match is ambiguous.
      await expect(
        page.getByRole("link", { name: feedA.title, exact: true }),
      ).toHaveCount(0, { timeout: 10000 });
      await expect(
        page.getByRole("link", { name: feedB.title, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: feedC.title, exact: true }),
      ).toBeVisible();
    } finally {
      for (const feed of feeds) {
        await deleteFeed(page, feed.id).catch(() => {});
      }
    }
  });

  test("delete confirmation dialog can be cancelled without deleting", async ({
    page,
    testFeed,
  }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

    await clickFeedCheckbox(page, testFeed.title);

    await page.getByRole("button", { name: "Feed Actions" }).click();
    await page.getByRole("menuitem").filter({ hasText: "Delete" }).click();

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });

    await confirmDialog.getByRole("button", { name: "Cancel" }).click();

    await expect(confirmDialog).toBeHidden({ timeout: 10000 });

    // The feed is still present.
    await expect(
      page.getByRole("link", { name: testFeed.title, exact: true }),
    ).toBeVisible();
  });
});
