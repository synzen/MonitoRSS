import { test, expect } from "../../fixtures/test-fixtures";
import {
  createFeed,
  deleteFeed,
  bulkDisableFeeds,
} from "../../helpers/api";
import type { Feed } from "../../helpers/types";
import type { Page, Locator } from "@playwright/test";

// Chakra v3 renders a visual control element over the checkbox input that
// intercepts pointer events, so a plain click lands on the wrong layer.
// scrollIntoView + force is the established idiom (see bulk-delete-feeds.spec.ts).
async function clickFeedCheckbox(page: Page, feedTitle: string) {
  const checkbox = page.getByRole("checkbox", {
    name: `Check feed ${feedTitle} for bulk actions`,
  });
  await checkbox.scrollIntoViewIfNeeded();
  await checkbox.click({ force: true });
}

// The feed's row carries the status icon and the title link, so scoping the
// status assertion to the row keeps it unambiguous across the whole table.
function feedRow(page: Page, feedTitle: string): Locator {
  return page.getByRole("row").filter({
    has: page.getByRole("link", { name: feedTitle, exact: true }),
  });
}

test.describe("Bulk Enable/Disable Feeds", () => {
  test("can bulk disable selected feeds through the UI", async ({ page }) => {
    const feeds: Feed[] = [];

    try {
      // Two feeds to disable, one left enabled so the assertions can prove the
      // action only affected the selection.
      feeds.push(
        await createFeed(page, { title: `Bulk Disable A ${Date.now()}` }),
      );
      feeds.push(
        await createFeed(page, { title: `Bulk Disable B ${Date.now()}` }),
      );
      feeds.push(
        await createFeed(page, { title: `Bulk Disable C ${Date.now()}` }),
      );

      const [feedA, feedB, feedC] = feeds;

      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      // Freshly created feeds start enabled.
      await expect(
        feedRow(page, feedA.title).getByLabel("Ok"),
      ).toBeVisible();

      await clickFeedCheckbox(page, feedA.title);
      await clickFeedCheckbox(page, feedB.title);

      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Disable" }).click();

      const confirmDialog = page.getByRole("alertdialog");
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });
      await expect(confirmDialog).toContainText("disable 2 feed(s)");

      await confirmDialog
        .getByRole("button", { name: "Confirm", exact: true })
        .click();

      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Successfully disabled feeds" }),
      ).toBeVisible({ timeout: 30000 });

      // The two selected feeds now render the manually-disabled status; the
      // untouched feed stays OK.
      await expect(
        feedRow(page, feedA.title).getByLabel("Manually disabled"),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        feedRow(page, feedB.title).getByLabel("Manually disabled"),
      ).toBeVisible();
      await expect(feedRow(page, feedC.title).getByLabel("Ok")).toBeVisible();
    } finally {
      for (const feed of feeds) {
        await deleteFeed(page, feed.id).catch(() => {});
      }
    }
  });

  test("can bulk enable manually-disabled feeds through the UI", async ({
    page,
  }) => {
    const feeds: Feed[] = [];

    try {
      feeds.push(
        await createFeed(page, { title: `Bulk Enable A ${Date.now()}` }),
      );
      feeds.push(
        await createFeed(page, { title: `Bulk Enable B ${Date.now()}` }),
      );

      const [feedA, feedB] = feeds;

      // Put both feeds into the manually-disabled state for setup so the UI has
      // something to enable.
      await bulkDisableFeeds(page, [feedA.id, feedB.id]);

      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      await expect(
        feedRow(page, feedA.title).getByLabel("Manually disabled"),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        feedRow(page, feedB.title).getByLabel("Manually disabled"),
      ).toBeVisible();

      await clickFeedCheckbox(page, feedA.title);
      await clickFeedCheckbox(page, feedB.title);

      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Enable" }).click();

      const confirmDialog = page.getByRole("alertdialog");
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });
      await expect(confirmDialog).toContainText("enable 2 feed(s)");

      await confirmDialog
        .getByRole("button", { name: "Confirm", exact: true })
        .click();

      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Successfully enabled feeds" }),
      ).toBeVisible({ timeout: 30000 });

      // Both feeds are back to the OK status.
      await expect(feedRow(page, feedA.title).getByLabel("Ok")).toBeVisible({
        timeout: 10000,
      });
      await expect(feedRow(page, feedB.title).getByLabel("Ok")).toBeVisible();
    } finally {
      for (const feed of feeds) {
        await deleteFeed(page, feed.id).catch(() => {});
      }
    }
  });

  // Keyboard-only path. The mouse tests force pointer events through the Chakra
  // control layer over the checkbox; a keyboard user takes a different code path
  // (focus + Space, no pointer layer), so this exercises behaviour the mouse
  // tests structurally cannot. It also asserts the dialog focus-trap contract.
  test("can bulk disable feeds using only the keyboard", async ({ page }) => {
    const feeds: Feed[] = [];

    try {
      feeds.push(
        await createFeed(page, { title: `Bulk Kbd Disable A ${Date.now()}` }),
      );
      feeds.push(
        await createFeed(page, { title: `Bulk Kbd Disable B ${Date.now()}` }),
      );

      const [feedA, feedB] = feeds;

      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
      await expect(feedRow(page, feedA.title).getByLabel("Ok")).toBeVisible();

      // Select the feed by focusing its checkbox and pressing Space. The
      // checkbox must be reachable and operable without a pointer.
      const checkboxA = page.getByRole("checkbox", {
        name: `Check feed ${feedA.title} for bulk actions`,
      });
      await checkboxA.focus();
      await expect(checkboxA).toBeFocused();
      await page.keyboard.press("Space");
      await expect(checkboxA).toBeChecked();

      // Open the Feed Actions menu from the keyboard.
      const trigger = page.getByRole("button", { name: "Feed Actions" });
      await trigger.focus();
      await expect(trigger).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu")).toBeVisible({ timeout: 10000 });

      // Ark menus open with the first enabled item highlighted (tracked via
      // data-highlighted + aria-activedescendant, not DOM :focus). With one
      // enabled feed selected the "Enable" item is disabled, so "Disable" is the
      // first enabled item and is highlighted on open.
      const disableItem = page
        .getByRole("menuitem")
        .filter({ hasText: "Disable" });
      await expect(disableItem).toHaveAttribute("data-highlighted", "", {
        timeout: 10000,
      });

      await page.keyboard.press("Enter");

      // The confirmation dialog must open AND receive focus (focus trap): a
      // keyboard user who can't reach the dialog's buttons is stranded.
      const confirmDialog = page.getByRole("alertdialog");
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });
      await expect(confirmDialog).toContainText("disable 1 feed(s)");
      await expect(confirmDialog.locator(":focus")).toBeVisible();

      // Activate Confirm from the keyboard.
      const confirmButton = confirmDialog.getByRole("button", {
        name: "Confirm",
        exact: true,
      });
      await confirmButton.focus();
      await expect(confirmButton).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Successfully disabled feeds" }),
      ).toBeVisible({ timeout: 30000 });

      // The selected feed is disabled; the unselected one is untouched.
      await expect(
        feedRow(page, feedA.title).getByLabel("Manually disabled"),
      ).toBeVisible({ timeout: 10000 });
      await expect(feedRow(page, feedB.title).getByLabel("Ok")).toBeVisible();
    } finally {
      for (const feed of feeds) {
        await deleteFeed(page, feed.id).catch(() => {});
      }
    }
  });
});
