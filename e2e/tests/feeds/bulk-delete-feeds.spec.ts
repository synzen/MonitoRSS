import { test, expect } from "../../fixtures/test-fixtures";
import { createFeed, deleteFeed, deleteAllUserFeeds } from "../../helpers/api";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  getUserMongoIdFromDiscordId,
  seedPersonalFeedsInDb,
} from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";
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

// Selecting all currently-loaded feeds. Right after a table refetch (e.g. the
// post-bulk-delete reload) the row set is still settling, so a single force
// click can land on a row that re-renders out from under it. Re-click until the
// selection registers, observed through the Feed Actions trigger enabling.
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
      // The row set re-rendered under the click; try again.
    }
  }
  await expect(trigger).not.toHaveAttribute("aria-disabled", "true");
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

  test("Feed Actions is usable again immediately after a bulk delete (no lingering modal backdrop)", async ({
    page,
  }) => {
    // Regression: the bulk-delete confirmation modal used to stay open for the
    // whole duration of the delete + feed-list refetch (the confirm awaited the
    // mutation, which awaited its query invalidation). Its interactive backdrop
    // sat over the page that entire time, so the Feed Actions control beneath it
    // showed a blocked cursor and "clicking around" landed on the still-present
    // (but visually gone) dialog's buttons. The dialog must close immediately on
    // confirm; the outcome is reported via a page alert.
    //
    // 25 feeds (page size is 20) so a second page auto-loads after the first is
    // deleted, exercising the heavy post-delete refetch that made the lag
    // visible. The personal API limit is 5, so feeds are seeded directly in the
    // DB (limits only gate creation, not display or deletion).
    await page.goto("/feeds");
    await expect(
      page.getByRole("button", { name: "Account settings" }),
    ).toBeVisible({ timeout: 15000 });

    const discordUserId = await getDiscordUserIdFromPage(page);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const stamp = Date.now();
    const titles = Array.from(
      { length: 25 },
      (_, i) => `Bulk Page ${stamp} ${String(i).padStart(2, "0")}`,
    );

    try {
      await seedPersonalFeedsInDb({
        userId: selfUserId,
        discordUserId,
        feeds: titles.map((title) => ({ title, url: MOCK_RSS_FEED_URL })),
      });

      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      // Select the whole loaded page and delete it through the menu + dialog.
      await clickSelectAllLoadedCheckbox(page);
      // Hold the bulk-delete response open for a few seconds. This makes the bug
      // deterministic: if the dialog only closes once the mutation resolves, it
      // (and its backdrop) stay over the page for the whole delay. With the fix
      // the dialog closes on click, independent of the in-flight request.
      const DELETE_DELAY_MS = 4000;
      await page.route("**/api/v1/user-feeds", async (route) => {
        if (route.request().method() === "PATCH") {
          await new Promise((resolve) => {
            setTimeout(resolve, DELETE_DELAY_MS);
          });
        }
        await route.continue();
      });

      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Delete" }).click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await dialog.getByRole("button", { name: "Delete", exact: true }).click();

      // The dialog and its backdrop must disappear immediately on confirm — well
      // before the delayed request resolves — so they never sit over the page
      // blocking the controls beneath.
      await expect(dialog).toBeHidden({ timeout: 1500 });
      await expect(page.locator(".chakra-dialog__backdrop")).toHaveCount(0, {
        timeout: 1500,
      });

      await page.unroute("**/api/v1/user-feeds");

      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Successfully deleted feeds" }),
      ).toBeVisible({ timeout: 30000 });

      // The remaining 5 feeds auto-load into offset 0.
      const survivorRows = page.getByRole("link", {
        name: new RegExp(`^Bulk Page ${stamp} \\d\\d$`),
      });
      await expect(survivorRows).toHaveCount(5, { timeout: 10000 });

      // The Feed Actions trigger is reachable, not buried under a backdrop:
      // selecting a feed and opening the menu with NON-force clicks succeeds
      // (a lingering backdrop would intercept the pointer and fail these).
      const firstSurvivor = await survivorRows.first().textContent();
      const survivorCheckbox = page.getByRole("checkbox", {
        name: `Check feed ${firstSurvivor} for bulk actions`,
      });
      await expect(async () => {
        await survivorCheckbox.click({ force: true });
        await expect(survivorCheckbox).toBeChecked({ timeout: 1000 });
      }).toPass({ timeout: 10000 });

      const trigger = page.getByRole("button", { name: "Feed Actions" });
      await trigger.click(); // non-force: fails if a backdrop covers the trigger
      await expect(page.getByRole("menu")).toBeVisible({ timeout: 10000 });
    } finally {
      await deleteAllUserFeeds(page).catch(() => {});
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
