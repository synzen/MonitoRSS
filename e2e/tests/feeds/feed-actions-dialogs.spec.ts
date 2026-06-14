import { test, expect } from "../../fixtures/test-fixtures";
import { createFeed, deleteFeed } from "../../helpers/api";
import type { Feed } from "../../helpers/types";
import type { Page } from "@playwright/test";

// Chakra v3 renders a visual control element over the checkbox input that
// intercepts pointer events, so a plain click lands on the wrong layer.
// scrollIntoView + force is the established idiom (see bulk-toggle-feeds.spec.ts).
async function clickFeedCheckbox(page: Page, feedTitle: string) {
  const checkbox = page.getByRole("checkbox", {
    name: `Check feed ${feedTitle} for bulk actions`,
  });
  await checkbox.scrollIntoViewIfNeeded();
  await checkbox.click({ force: true });
}

// These tests guard a regression where opening the Clone or Copy-settings
// dialog from the user feeds list page's "Feed Actions" menu would flash the
// dialog open and immediately close it. The dialogs are rendered inside the
// menu content, so when the menu closed on item-click it unmounted the dialog
// state along with it. The assertion that proves the fix is simply that the
// dialog stays visible long enough to interact with.
test.describe("Feed Actions dialogs (list page)", () => {
  test("can open the Clone dialog from the Feed Actions menu and it stays open", async ({
    page,
  }) => {
    const feeds: Feed[] = [];

    try {
      feeds.push(await createFeed(page, { title: `Clone Dialog A ${Date.now()}` }));

      const [feedA] = feeds;

      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      await clickFeedCheckbox(page, feedA.title);

      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Clone" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // The dialog must remain mounted, not flash and disappear. Re-asserting
      // visibility after a beat catches the "open for a split second then close"
      // regression that an immediate single assertion can race past.
      await page.waitForTimeout(1000);
      await expect(dialog).toBeVisible();

      // It is the clone dialog and it is interactive: the title field is
      // pre-filled with the original feed title suffixed with " (Clone)".
      const titleInput = dialog.locator("input").first();
      await expect(titleInput).toHaveValue(`${feedA.title} (Clone)`, {
        timeout: 10000,
      });
    } finally {
      for (const feed of feeds) {
        await deleteFeed(page, feed.id).catch(() => {});
      }
    }
  });

  test("can open the Copy settings dialog from the Feed Actions menu and it stays open", async ({
    page,
  }) => {
    const feeds: Feed[] = [];

    try {
      feeds.push(await createFeed(page, { title: `Copy Settings A ${Date.now()}` }));

      const [feedA] = feeds;

      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      await clickFeedCheckbox(page, feedA.title);

      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Copy settings to..." }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Must stay mounted rather than flash and close.
      await page.waitForTimeout(1000);
      await expect(dialog).toBeVisible();

      // It is the copy-settings dialog and it has rendered its source feed.
      // The feed title also appears in the target-feed selection list, so scope
      // the source-feed assertion to the heading to keep it unambiguous.
      await expect(
        dialog.getByRole("heading", { name: "Copy feed settings" }),
      ).toBeVisible({ timeout: 10000 });
      await expect(dialog.getByText(feedA.title).first()).toBeVisible({
        timeout: 10000,
      });
    } finally {
      for (const feed of feeds) {
        await deleteFeed(page, feed.id).catch(() => {});
      }
    }
  });
});
