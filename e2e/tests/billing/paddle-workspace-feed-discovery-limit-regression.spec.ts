import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage, setPersonalFeedLimitInDb } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import { cancelAndDeleteWorkspace } from "../../helpers/paddle-cleanup";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// Regression: a workspace with a real Tier 2 subscription (70-feed limit) whose
// OWNER has a small PERSONAL feed limit. The feed-discovery UI must gate on the
// WORKSPACE limit, not the owner's personal one. The bug: the "Add a Feed" modal
// (and the inline discovery cards) computed isAtLimit from the personal
// maxUserFeeds, so once the workspace held as many feeds as the owner's personal
// cap, every card read "Limit reached" — 3/70 with no way to add — despite 67
// slots of headroom. Runs against the REAL Paddle sandbox so the workspace's
// 70-feed limit is genuinely subscription-derived.

const PERSONAL_FEED_LIMIT = 3;

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

// Enable workspaces + verified email, then create a fresh team through the UI and
// land on its dormant Billing page. Returns the new workspace slug.
async function createTeamAndOpenBilling(page: Page): Promise<string> {
  await page.goto("/feeds");
  await waitForAuthenticatedApp(page);

  const discordUserId = await getDiscordUserIdFromPage(page);
  await enableWorkspacesFeatureInDb(discordUserId);
  await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);
  // Cap the OWNER's personal feed limit below the workspace's 70. This is the
  // condition that surfaces the regression.
  await setPersonalFeedLimitInDb(discordUserId, PERSONAL_FEED_LIMIT);
  await page.reload();
  await waitForAuthenticatedApp(page);

  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(`E2E Limit Regression ${Date.now()}`);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  const workspaceSlug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(workspaceSlug).toBeTruthy();

  await expect(
    page.getByRole("heading", { name: /Activate your workspace to start adding feeds/i }),
  ).toBeVisible({ timeout: 15000 });

  await page
    .getByRole("link", { name: /activate workspace/i })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceSlug}/settings/billing$`));
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/\/ (month|year)/).first()).toBeVisible({ timeout: 30000 });

  return workspaceSlug as string;
}

// Fill and submit the Tier 2 Paddle checkout, then wait for the webhook to flip
// the page to the active current-plan view. The checkout renders INLINE inside a
// Chakra dialog, so the Paddle iframe lives within [role=dialog]; scope to it.
async function completeInlineCheckout(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15000 });

  const overlayIframe = dialog.locator('iframe[name*="paddle"], iframe[src*="paddle"]');
  await expect(overlayIframe.first()).toBeVisible({ timeout: 15000 });

  const paddleFrame = dialog
    .frameLocator('iframe[name*="paddle"], iframe[src*="paddle"]')
    .first();
  const cardInput = paddleFrame.getByRole("textbox", { name: "Card number" });
  await expect(cardInput).toBeVisible({ timeout: 30000 });

  await paddleFrame.getByRole("combobox", { name: "Country" }).selectOption("United States");
  await paddleFrame.getByRole("textbox", { name: "ZIP/Postcode" }).fill("12345");
  await page.waitForTimeout(3000);

  await cardInput.fill("4242424242424242");
  await paddleFrame.getByRole("textbox", { name: "Expiry" }).fill("1230");
  await paddleFrame.getByRole("textbox", { name: "CVV" }).fill("123");
  await paddleFrame.getByRole("textbox", { name: "Card holder" }).fill("Test User");

  const subscribeButton = paddleFrame.getByRole("button", { name: /subscribe now/i });
  await expect(subscribeButton).toBeVisible({ timeout: 5000 });
  await subscribeButton.click();

  await page.waitForTimeout(5000);
  const taxMessage = paddleFrame.getByText("Click 'Subscribe now' to try again");
  if (await taxMessage.isVisible().catch(() => false)) {
    await subscribeButton.click();
  }

  await expect(page.getByRole("heading", { name: "Current plan" })).toBeVisible({
    timeout: 120_000,
  });
}

// Enter the workspace scope from the switcher and anchor on the committed scope so
// subsequent feed adds are validated with workspace credentials (scope-switch is
// async; the URL updates before React commits the new scope).
async function enterWorkspaceScope(page: Page, workspaceSlug: string): Promise<void> {
  await page.getByRole("button", { name: /Switch workspace/ }).click();
  await page.getByRole("menuitemradio", { name: /e2e limit regression/i }).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceSlug}/feeds$`), {
    timeout: 15000,
  });
  await expect(
    page.getByRole("button", { name: /Switch workspace, current: E2E Limit Regression/i }),
  ).toBeVisible({ timeout: 15000 });
}

// Add one feed from the mock RSS server through the inline discovery search on the
// empty/adding workspace feeds page, then return to the feeds view. Each call uses
// a unique URL so the mock server yields a distinct feed.
async function addMockFeedInline(page: Page, index: number): Promise<void> {
  const search = page.getByRole("textbox", { name: "Search popular feeds or paste a URL" });
  await search.fill(`${MOCK_RSS_FEED_URL}&regression=${index}`);
  await page.getByRole("button", { name: "Go", exact: true }).click();
  const addButton = page.getByRole("button", { name: /^Add .+ feed$/i }).first();
  await expect(addButton).toBeVisible({ timeout: 30000 });
  await addButton.click();
  await expect(page.getByRole("button", { name: /^Remove .+ feed$/i }).first()).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Paddle workspace feed-discovery limit regression", () => {
  test("owner with a small personal limit can still add feeds up to the workspace's 70-feed limit", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const workspaceSlug = await createTeamAndOpenBilling(page);

    // Subscribe to Tier 2 (70 feeds), completing the real sandbox checkout.
    await page.getByRole("button", { name: /subscribe to team, 70 feeds total/i }).click();
    await completeInlineCheckout(page);
    await expect(page.getByText("Current plan").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("70 feeds").first()).toBeVisible({ timeout: 10000 });

    await enterWorkspaceScope(page, workspaceSlug);

    // Fill the workspace up to the owner's PERSONAL limit (3). The workspace still
    // has 67 slots free, but the buggy gate keys on the personal 3.
    await expect(
      page.getByRole("heading", { name: "Add feeds for your workspace" }),
    ).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < PERSONAL_FEED_LIMIT; i += 1) {
      await addMockFeedInline(page, i);
    }
    await page.getByRole("button", { name: /View your feeds/ }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceSlug}/feeds$`), {
      timeout: 15000,
    });
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

    // Open the "Add a Feed" modal — the exact surface from the bug report.
    await page.getByRole("button", { name: "Add Feed", exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByRole("heading", { name: "Add a Feed" })).toBeVisible({
      timeout: 15000,
    });

    // The limit bar reflects the WORKSPACE limit with real headroom (matches the
    // "Feed Limit: 3/70" from the bug report), not the personal 3/3.
    await expect(modal.getByText(`Feed Limit: ${PERSONAL_FEED_LIMIT}/70`)).toBeVisible({
      timeout: 15000,
    });

    // The regression: with headroom, no card may read "Limit reached", and pasting
    // a fresh mock URL must yield an enabled Add button (not a disabled limit card).
    const modalSearch = modal.getByRole("textbox", {
      name: "Search popular feeds or paste a URL",
    });
    await modalSearch.fill(`${MOCK_RSS_FEED_URL}&regression-extra=1`);
    await modal.getByRole("button", { name: "Go", exact: true }).click();

    await expect(modal.getByRole("button", { name: /^Add .+ feed$/i }).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(modal.getByRole("button", { name: /limit reached/i })).toHaveCount(0);

    // Actually add the 4th feed to prove the workspace accepts it past the personal
    // cap, then confirm it landed in the workspace table.
    await modal.getByRole("button", { name: /^Add .+ feed$/i }).first().click();
    await expect(modal.getByRole("button", { name: /^Remove .+ feed$/i }).first()).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: /^Configure/ })).toHaveCount(
      PERSONAL_FEED_LIMIT + 1,
    );

    // Teardown: cancel the sandbox subscription, then delete the workspace.
    await cancelAndDeleteWorkspace(page, workspaceSlug);
  });
});
