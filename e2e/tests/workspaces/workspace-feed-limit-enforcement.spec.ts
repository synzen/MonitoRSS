import { test, expect, type Page } from "../../fixtures/test-fixtures";
import type { Locator } from "@playwright/test";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  setVerifiedEmailInDb,
  setDisabledFeedAlertPreferenceInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceWithMembershipsInDb,
  seedAlertableWorkspaceMemberInDb,
  seedWorkspaceFeedsInDb,
} from "../../helpers/workspaces-db";
import { waitForMail, peekMail, resetCapturedMail } from "../../helpers/smtp";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// Workspace feed-limit enforcement: the over-limit state only arises when a
// workspace's limit DROPS below its existing feed count (the future billing
// downgrade), so the feeds are seeded directly — creation through the API is
// atomically gated and can never exceed the limit. The stack runs with
// BACKEND_API_DEFAULT_MAX_WORKSPACE_FEEDS=5 (docker-compose.e2e.yml).
//
// The user-reachable trigger exercised here is bulk-enable: enabling a paused
// feed pushes the enabled count over the limit, and post-mutation enforcement
// disables the OLDEST feed and emails a digest to all opted-in members. Freeing
// headroom (deleting a feed) silently re-enables the disabled feed.

const WORKSPACE_FEED_LIMIT = 5;

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

async function clickFeedCheckbox(page: Page, feedTitle: string) {
  // Chakra v3 renders a visual control over the checkbox input; force-click the
  // input layer (same idiom as bulk-toggle-feeds.spec.ts). A table refetch can
  // re-render the row and drop the selection, so verify it registered (an
  // unselected feed silently disables the menu action under test).
  const checkbox = page.getByRole("checkbox", {
    name: `Check feed ${feedTitle} for bulk actions`,
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.click({ force: true });
    try {
      await expect(checkbox).toBeChecked({ timeout: 2000 });
      return;
    } catch {
      // re-click — the row re-rendered underneath the click
    }
  }
  await expect(checkbox).toBeChecked();
}

function feedRow(page: Page, feedTitle: string): Locator {
  return page.getByRole("row").filter({
    has: page.getByRole("link", { name: feedTitle, exact: true }),
  });
}

// Pointer clicks on Ark menu items flake while the menu is animating/repositioning
// ("element is not stable"); keyboard navigation is the reliable idiom (see
// bulk-toggle-feeds.spec.ts keyboard test). Opens the Feed Actions menu, walks the
// highlight to the target item with ArrowDown, and activates it with Enter.
async function chooseFeedAction(page: Page, itemText: string) {
  const trigger = page.getByRole("button", { name: "Feed Actions" });
  const menu = page.getByRole("menu");

  // A just-opened menu can be closed underneath us by a page re-render (e.g.
  // the feed-list refetch right after navigation), and until Ark moves focus
  // onto the menu content, Enter hits the trigger and toggles it shut. Re-open
  // until the menu is open AND focused, then it's safe to drive with keys.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await trigger.focus();
    await page.keyboard.press("Enter");
    try {
      await expect(menu).toBeVisible({ timeout: 5000 });
      await expect(menu).toBeFocused({ timeout: 3000 });
      break;
    } catch {
      await page.keyboard.press("Escape");
    }
  }
  await expect(menu).toBeFocused();

  // Ark highlights the first enabled item on open; wait for that before walking,
  // or an early ArrowDown skips past it.
  await expect(page.locator('[role="menuitem"][data-highlighted]')).toBeVisible({
    timeout: 10000,
  });

  const item = page.getByRole("menuitem").filter({ hasText: itemText });
  for (let i = 0; i < 12; i += 1) {
    if ((await item.getAttribute("data-highlighted")) !== null) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(item).toHaveAttribute("data-highlighted", "", { timeout: 5000 });
  await page.keyboard.press("Enter");
}

test.describe("Workspace feed limit enforcement", () => {
  test("disables the oldest feed with a member digest email when enabling pushes the workspace over its limit, and silently re-enables when headroom returns", async ({
    page,
  }) => {
    // Two UI phases plus email polling exceed the default 30s budget.
    test.setTimeout(120_000);

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    const selfEmail = `verified-${discordUserId}@example.com`;
    const memberEmail = `member-${discordUserId}@example.com`;

    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, selfEmail);
    await setDisabledFeedAlertPreferenceInDb(discordUserId);

    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);
    const workspaceName = `E2E Limit WS ${Date.now()}`;
    const { workspaceId, slug } = await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
    });
    await seedAlertableWorkspaceMemberInDb({ workspaceId, email: memberEmail });

    // 5 enabled feeds (at the limit) plus a manually-paused 6th: the state a
    // limit decrease leaves behind. "Oldest Feed" is created first.
    await seedWorkspaceFeedsInDb({
      workspaceId,
      userId: selfUserId,
      discordUserId,
      feeds: [
        { title: "Oldest Feed", url: MOCK_RSS_FEED_URL },
        ...Array.from({ length: WORKSPACE_FEED_LIMIT - 1 }, (_, i) => ({
          title: `Filler Feed ${i + 1}`,
          url: MOCK_RSS_FEED_URL,
        })),
        { title: "Paused Feed", url: MOCK_RSS_FEED_URL, disabledCode: "MANUAL" },
      ],
    });

    await resetCapturedMail([selfEmail, memberEmail]);

    // Enter the workspace through the switcher and anchor on the committed scope.
    await page.reload();
    await waitForAuthenticatedApp(page);
    await page.getByRole("button", { name: /Switch team/ }).click();
    await page.getByRole("menuitemradio", { name: workspaceName }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`), { timeout: 15000 });
    await expect(
      page.getByRole("button", { name: `Switch team, current: ${workspaceName}` }),
    ).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    await expect(feedRow(page, "Paused Feed").getByLabel("Manually disabled")).toBeVisible({
      timeout: 10000,
    });
    await expect(feedRow(page, "Oldest Feed").getByLabel("Ok")).toBeVisible();

    // Enable the paused feed: the workspace is now one over its limit, so
    // enforcement disables the oldest feed.
    await clickFeedCheckbox(page, "Paused Feed");
    await chooseFeedAction(page, "Enable");

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });
    await confirmDialog.getByRole("button", { name: "Confirm", exact: true }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Successfully enabled feeds" }),
    ).toBeVisible({ timeout: 30000 });

    await expect(feedRow(page, "Paused Feed").getByLabel("Ok")).toBeVisible({ timeout: 10000 });
    await expect(
      feedRow(page, "Oldest Feed").getByLabel("Disabled (feed limit exceeded)"),
    ).toBeVisible({
      timeout: 10000,
    });

    // A limit-disabled feed is not a health problem: the requires-attention banner
    // (driven by the computed-status count) must not appear for it.
    await expect(page.getByText(/requires? your attention/)).not.toBeVisible();

    // The feed's own page explains the workspace-scoped reason. (Chakra v3
    // Alert.Root renders without role=alert, so match the copy itself.)
    await page.getByRole("link", { name: "Oldest Feed", exact: true }).click();
    await expect(
      page.getByText("disabled because the workspace is over its feed limit"),
    ).toBeVisible({ timeout: 15000 });

    // Every opted-in member receives one digest naming the disabled feed.
    for (const email of [selfEmail, memberEmail]) {
      const mail = await waitForMail(email);
      expect(mail.subject).toContain(workspaceName);
      expect(mail.subject).toContain("feed limit exceeded");
      expect(mail.body).toContain("Oldest Feed");
      expect(mail.body).toContain(`/workspaces/${slug}/feeds`);
    }

    // Free headroom by deleting a feed through the UI: the ExceededFeedLimit feed
    // comes back automatically — and silently (no new email).
    await resetCapturedMail([selfEmail, memberEmail]);
    await page.goBack();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

    await clickFeedCheckbox(page, "Paused Feed");
    await chooseFeedAction(page, "Delete");

    const deleteDialog = page.getByRole("alertdialog");
    await expect(deleteDialog).toBeVisible({ timeout: 10000 });
    await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Successfully deleted feeds" }),
    ).toBeVisible({ timeout: 30000 });

    await expect(feedRow(page, "Oldest Feed").getByLabel("Ok")).toBeVisible({ timeout: 10000 });
    expect(await peekMail(selfEmail)).toBeNull();
    expect(await peekMail(memberEmail)).toBeNull();
  });
});
