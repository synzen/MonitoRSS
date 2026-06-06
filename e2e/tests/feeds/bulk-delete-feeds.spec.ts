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

  test("clicking a disabled bulk action menu item does not open its dialog", async ({
    page,
    testFeed,
  }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

    // A freshly created feed is enabled, so the "Enable" action is disabled
    // (there are no manually-disabled feeds in the selection to enable).
    await clickFeedCheckbox(page, testFeed.title);

    await page.getByRole("button", { name: "Feed Actions" }).click();

    const enableMenuItem = page
      .getByRole("menuitem")
      .filter({ hasText: "Enable" });
    await expect(enableMenuItem).toBeVisible({ timeout: 10000 });
    await expect(enableMenuItem).toHaveAttribute("aria-disabled", "true");

    // Clicking a disabled menu item must be a no-op: no confirmation dialog.
    await enableMenuItem.click({ force: true });

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("Feed Actions trigger is disabled when no feeds are selected", async ({
    page,
    testFeed,
  }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

    // With no selection every action would be disabled. Rather than open the
    // menu into a focusable void (which screen readers announce as nothing),
    // the trigger is aria-disabled so it stays focusable and is announced as
    // unavailable. It must NOT use the native `disabled` attribute, which would
    // remove it from the tab order and silence it entirely.
    const trigger = page.getByRole("button", { name: "Feed Actions" });
    await expect(trigger).toHaveAttribute("aria-disabled", "true");
    // Still reachable by keyboard/AT: the native disabled attribute is absent.
    await expect(trigger).not.toHaveAttribute("disabled", "");

    // It must not open: forcing a click past the disabled state shows no menu.
    await trigger.click({ force: true });
    await expect(page.getByRole("menu")).toHaveCount(0);

    // Selecting a feed enables the trigger and the menu opens normally.
    await clickFeedCheckbox(page, testFeed.title);
    await expect(trigger).not.toHaveAttribute("aria-disabled", "true");
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 10000 });
  });
});
