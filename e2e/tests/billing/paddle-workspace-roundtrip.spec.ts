import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceWithMembershipsInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import { cancelAndDeleteWorkspace } from "../../helpers/paddle-cleanup";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// Workspace subscription roundtrip against the REAL Paddle sandbox (e2e-paddle
// project, run manually with credentials + tunnel): create a workspace → land
// on the dormant activation CTA → complete sandbox checkout from the Billing
// page → the workspace becomes active → add a feed through the UI.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

// Enable the workspaces feature + verified email for the signed-in user, then
// create a fresh team through the UI and land on its dormant Billing page.
// Returns the new workspace slug.
async function createTeamAndOpenBilling(
  page: Page,
): Promise<{ workspaceSlug: string; verifiedEmail: string }> {
  await page.goto("/feeds");
  await waitForAuthenticatedApp(page);

  const discordUserId = await getDiscordUserIdFromPage(page);
  await enableWorkspacesFeatureInDb(discordUserId);
  const verifiedEmail = `verified-${discordUserId}@example.com`;
  await setVerifiedEmailInDb(discordUserId, verifiedEmail);
  await page.reload();
  await waitForAuthenticatedApp(page);

  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(`E2E Paddle Team ${Date.now()}`);
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
  // Prices render only after Paddle.js initializes; waiting for them ensures the
  // subscribe click can actually open the overlay.
  await expect(page.getByText(/\/ (month|year)/).first()).toBeVisible({ timeout: 30000 });

  return { workspaceSlug: workspaceSlug as string, verifiedEmail };
}

// Fill and submit the Paddle checkout the subscribe button opens, then wait for
// the webhook to flip the page to the active current-plan view. The checkout
// renders INLINE inside a Chakra dialog (not Paddle's page-leaking overlay), so
// the Paddle iframe lives within the [role=dialog]; scope to it.
async function completeInlineCheckout(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15000 });

  // The checkout iframe is not the page's only iframe — target it within the
  // dialog explicitly.
  const overlayIframe = dialog.locator('iframe[name*="paddle"], iframe[src*="paddle"]');
  await expect(overlayIframe.first()).toBeVisible({ timeout: 15000 });

  const paddleFrame = dialog
    .frameLocator('iframe[name*="paddle"], iframe[src*="paddle"]')
    .first();
  const cardInput = paddleFrame.getByRole("textbox", { name: "Card number" });
  await expect(cardInput).toBeVisible({ timeout: 30000 });

  // Fill country/ZIP first so Paddle calculates tax before submission.
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

  // Paddle may recalculate tax after submission; if it asks to click again, do so.
  await page.waitForTimeout(5000);
  const taxMessage = paddleFrame.getByText("Click 'Subscribe now' to try again");
  if (await taxMessage.isVisible().catch(() => false)) {
    await subscribeButton.click();
  }

  // The webhook activates the workspace; the Billing page polls the workspace
  // read and flips to the current-plan view without user action.
  await expect(page.getByRole("heading", { name: "Current plan" })).toBeVisible({
    timeout: 120_000,
  });
}

test.describe("Paddle workspace roundtrip", () => {
  test("dormant workspace activates through sandbox checkout and can add a feed", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const { workspaceSlug, verifiedEmail } = await createTeamAndOpenBilling(page);

    // Subscribing is the act of consent, so the payment terms must sit above the
    // Subscribe buttons (read before committing), not below where the overlay
    // would open over them. Assert the terms link precedes the first Subscribe
    // button in document order, which is also the tab order.
    const termsLink = page.getByRole("link", { name: /terms and conditions/i });
    const firstSubscribe = page.getByRole("button", { name: /subscribe to/i }).first();
    await expect(termsLink).toBeVisible();
    const termsBeforeSubscribe = await termsLink.evaluate(
      (terms, subscribe) =>
        !!(terms.compareDocumentPosition(subscribe) & Node.DOCUMENT_POSITION_FOLLOWING),
      (await firstSubscribe.elementHandle())!,
    );
    expect(termsBeforeSubscribe).toBe(true);

    // Grab a handle to a control behind the soon-to-open dialog WHILE it is still
    // in the accessibility tree. Once the dialog opens it inerts its siblings,
    // which removes the breadcrumb from the a11y tree, so a role-based locator
    // would no longer resolve it (the handle still references the DOM node).
    const breadcrumbHandle = await page
      .getByRole("link", { name: "Workspace settings" })
      .elementHandle();

    // Subscribe to Tier 2 (monthly default): opens the inline checkout dialog.
    await page.getByRole("button", { name: /subscribe to team, 70 feeds total/i }).click();

    // The checkout is hosted in a modal dialog that must trap focus: a keyboard
    // user must not be able to reach the page behind it. The dialog inerts its
    // siblings, so trying to focus the breadcrumb is a no-op and focus stays
    // within the dialog.
    const checkoutDialog = page.getByRole("dialog");
    await expect(checkoutDialog).toBeVisible({ timeout: 15000 });
    const trapped = await breadcrumbHandle!.evaluate((el) => {
      (el as HTMLElement).focus();

      return (
        document.activeElement !== el && !!document.activeElement?.closest('[role="dialog"]')
      );
    });
    expect(trapped).toBe(true);

    // Cancel and reopen once: a second open must repaint the inline Paddle frame
    // into a freshly-mounted container (the dialog tears the previous one down),
    // so the card field must appear again rather than a blank frame.
    await page.keyboard.press("Escape");
    await expect(checkoutDialog).toHaveCount(0);
    // Inert is lifted, so the breadcrumb can hold focus again (the dialog
    // returned focus to its opener, but the breadcrumb is reachable regardless).
    const reReachable = await breadcrumbHandle!.evaluate((el) => {
      (el as HTMLElement).focus();

      return document.activeElement === el;
    });
    expect(reReachable).toBe(true);
    await page.getByRole("button", { name: /subscribe to team, 70 feeds total/i }).click();
    await expect(checkoutDialog).toBeVisible({ timeout: 15000 });

    await completeInlineCheckout(page);

    // The dialog closed itself on success; the page behind is interactive again,
    // so the breadcrumb can take focus once more (inert lifted).
    await expect(checkoutDialog).toHaveCount(0);
    const restored = await breadcrumbHandle!.evaluate((el) => {
      (el as HTMLElement).focus();

      return document.activeElement === el;
    });
    expect(restored).toBe(true);

    // The plan is named "Team" on every card now (capacity distinguishes
    // them), so confirm the subscription landed via the unique "Current plan"
    // badge that marks the active 70-feed card.
    await expect(page.getByText("Current plan").first()).toBeVisible();
    await expect(page.getByText("70 feeds").first()).toBeVisible();

    // The activated plan is billed to the owner's verified email, surfaced as a
    // "Billed to" line on the current-plan view. This confirms the webhook
    // persisted the verified email (not the Discord email Paddle echoes back).
    await expect(page.getByText(verifiedEmail)).toBeVisible({ timeout: 30000 });

    // Change-capacity confirmation discloses the prorated amount AND the recurring
    // charge before committing. Open the capacity dialog, raise the slider to a
    // higher detent, and assert the dialog renders the itemized "Due today"
    // breakdown and the recurring "Then" line, driven by the real Paddle proration
    // preview.
    const changeDialog = page.getByRole("dialog");
    // The activation transaction may still be processing when we open the dialog;
    // Paddle then rejects the proration preview with
    // "subscription_credit_creation_against_processing_transaction" (a 400 the
    // UI surfaces as "Failed to load change preview"). Re-open and re-drag until
    // the transaction settles and the preview resolves.
    await expect(async () => {
      if ((await changeDialog.count()) > 0) {
        await changeDialog.getByRole("button", { name: "Cancel" }).click();
        await expect(changeDialog).toHaveCount(0);
      }

      await page.getByRole("button", { name: /change capacity/i }).click();
      // Dialog + slider are instant client renders; short timeouts so a UI break
      // fails this attempt fast instead of stalling the retry budget.
      const slider = changeDialog.getByRole("slider", { name: /how many feeds/i });
      await expect(slider).toBeVisible({ timeout: 10000 });
      // Seeded at the current 70 feeds; step up two detents (70 -> 100 -> 140).
      await slider.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect(slider).toHaveAttribute("aria-valuetext", "140 feeds", { timeout: 5000 });
      // Only the prorated preview is webhook-gated; it is the one slow wait here.
      await expect(changeDialog.getByText("Total due today")).toBeVisible({ timeout: 15000 });
    }).toPass({ timeout: 120_000, intervals: [5000] });

    // Itemized due-today block, from the live Paddle proration preview. The
    // preview already resolved inside the toPass above, so these are instant.
    await expect(changeDialog.getByText("Subtotal")).toBeVisible({ timeout: 5000 });
    await expect(changeDialog.getByText("Tax")).toBeVisible({ timeout: 5000 });
    // The compliance-critical recurring disclosure.
    await expect(changeDialog.getByText("Then")).toBeVisible({ timeout: 5000 });
    await expect(changeDialog.getByText(/\/ month, starting/)).toBeVisible({ timeout: 5000 });
    await expect(changeDialog.getByText(/Renews automatically\. Cancel anytime\./)).toBeVisible({
      timeout: 5000,
    });
    // Dismiss without changing: this run only verifies the disclosure, and the
    // teardown cancels the subscription it already created.
    await changeDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(changeDialog).toHaveCount(0);

    // The dormant CTA is gone and a feed can be added through the UI.
    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: /e2e paddle team/i }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceSlug}/feeds$`));
    await expect(
      page.getByRole("heading", { name: /Activate your workspace to start adding feeds/i }),
    ).toHaveCount(0);
    await expect(page.getByText("This workspace is not subscribed")).toHaveCount(0);

    await expect(
      page.getByRole("heading", { name: "Add feeds for your workspace" }),
    ).toBeVisible({ timeout: 15000 });
    const search = page.getByRole("textbox", { name: "Search popular feeds or paste a URL" });
    await search.fill(MOCK_RSS_FEED_URL);
    await page.getByRole("button", { name: "Go", exact: true }).click();
    await page
      .getByRole("button", { name: /^Add .+ feed$/i })
      .first()
      .click();
    await page.getByRole("button", { name: /View your feeds/ }).click();
    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible();

    // Teardown: cancel the workspace's sandbox subscription, then delete it
    // (deletion is gated on cancellation first), so the Paddle sandbox does not
    // accumulate live subscriptions across runs.
    await cancelAndDeleteWorkspace(page, workspaceSlug);
  });

  test("pricing dialog reroutes the team CTA to an owned workspace that needs billing", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // Owning a workspace that needs billing (here, never activated) must turn the
    // pricing dialog's "create a workspace" CTA into a reroute to that workspace,
    // so the owner bills the one they have instead of creating another. The
    // workspace is seeded directly so this assertion does not depend on the slow
    // create-and-activate flow the other tests already cover.
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);
    const { slug: workspaceSlug } = await seedWorkspaceWithMembershipsInDb({
      workspaceName: `E2E CTA Team ${discordUserId}`,
      selfUserId,
      selfRole: "owner",
    });
    await page.reload();
    await waitForAuthenticatedApp(page);

    // Open the pricing dialog from account settings (billing is enabled for this
    // account, so the Manage Subscription entry is present).
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();
    await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "Manage Subscription" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Pricing", level: 1 })).toBeVisible({
      timeout: 15000,
    });

    // The team region offers a reroute, never the create-a-second-workspace CTA.
    const forTeam = dialog.getByRole("region", { name: /for your team/i });
    await expect(
      forTeam.getByRole("button", { name: /create workspace for \d+ feeds/i }),
    ).toHaveCount(0);
    await forTeam.getByRole("button", { name: /go to your workspace/i }).click();

    // Landing on the owned workspace's billing page, carrying the slider capacity.
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceSlug}/settings/billing\\?feeds=\\d+$`),
      { timeout: 15000 },
    );
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 15000 });
  });

  test("pricing dialog keeps the create CTA for an owner of only a paid workspace", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // A workspace with an active subscription does not need billing, so its owner
    // is allowed to create another. The pricing dialog must keep the create CTA
    // for them and not reroute. The seeded workspace carries an active
    // subscription to stand in for one already paid for.
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);
    await seedWorkspaceWithMembershipsInDb({
      workspaceName: `E2E Paid Team ${discordUserId}`,
      selfUserId,
      selfRole: "owner",
      withActiveSubscription: true,
    });
    await page.reload();
    await waitForAuthenticatedApp(page);

    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();
    await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "Manage Subscription" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Pricing", level: 1 })).toBeVisible({
      timeout: 15000,
    });

    // The team region still offers creation, never the owner reroute.
    const forTeam = dialog.getByRole("region", { name: /for your team/i });
    await expect(
      forTeam.getByRole("button", { name: /create workspace for \d+ feeds/i }),
    ).toBeVisible();
    await expect(forTeam.getByRole("button", { name: /go to your workspace/i })).toHaveCount(0);
  });

  test("raises a team's capacity via the slider and the new limit is reflected in the UI", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const { workspaceSlug } = await createTeamAndOpenBilling(page);

    // Activate at 140 feeds ANNUAL: raising capacity immediately afterwards
    // prorates the add-on over the remaining period, which on a monthly plan can
    // fall under Paddle's $0.70 minimum and be rejected. A year comfortably clears
    // it, so the change preview is deterministic.
    await page.getByRole("button", { name: "Yearly" }).click();
    // The activation slider starts at the base 70 feeds; drag it up two detents
    // (70 -> 100 -> 140) so the single Subscribe button targets 140-feed capacity.
    const activationSlider = page.getByRole("slider", { name: /how many feeds/i });
    await activationSlider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(activationSlider).toHaveAttribute("aria-valuetext", "140 feeds", {
      timeout: 5000,
    });
    await page.getByRole("button", { name: /subscribe to team, 140 feeds total/i }).click();
    // completeInlineCheckout already waits out the activation webhook, so the page
    // is on the active current-plan view by the time it returns; these are instant
    // client renders. Short timeouts so a UI regression fails in seconds, not at
    // the test-level ceiling. Every capacity is base tier + per-feed add-ons, so
    // 140 feeds is 70 base + 70 additional (buy and manage baskets are identical).
    await completeInlineCheckout(page);
    await expect(page.getByText("Current plan").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("140 feeds (70 + 70 additional)")).toBeVisible({ timeout: 10000 });

    // The capacity slider is detents-only: from 140 the next reachable capacity is
    // 200 feeds (base 70 + 130 add-on feeds), not an arbitrary +N. Open the
    // change-capacity dialog and step up one detent.
    const changeDialog = page.getByRole("dialog");
    await expect(async () => {
      if ((await changeDialog.count()) > 0) {
        await changeDialog.getByRole("button", { name: "Cancel" }).click();
        await expect(changeDialog).toHaveCount(0);
      }

      await page.getByRole("button", { name: /change capacity/i }).click();
      // The dialog + slider are instant client renders; short timeouts so a UI
      // break fails this attempt fast instead of stalling the retry budget.
      const slider = changeDialog.getByRole("slider", { name: /how many feeds/i });
      await expect(slider).toBeVisible({ timeout: 10000 });
      // Seeded at the current 140 feeds (detent index 2); one step up is 200.
      await expect(slider).toHaveAttribute("aria-valuetext", "140 feeds", { timeout: 5000 });
      await slider.focus();
      await page.keyboard.press("ArrowRight");
      await expect(slider).toHaveAttribute("aria-valuetext", "200 feeds", { timeout: 5000 });
      // Only the prorated preview is webhook-gated; it is the one slow wait here.
      await expect(changeDialog.getByText("Total due today")).toBeVisible({ timeout: 15000 });
    }).toPass({ timeout: 120_000, intervals: [5000] });

    await changeDialog.getByRole("button", { name: /confirm change/i }).click();
    await expect(changeDialog).toHaveCount(0, { timeout: 60000 });

    // The change lands via webhook, so the rendered current-plan text lags the
    // confirmed change; reload until it reflects the new 200-feed capacity (base
    // 70 + 130 additional).
    await expect(async () => {
      await page.reload();
      await expect(page.getByText("200 feeds (70 + 130 additional)")).toBeVisible({
        timeout: 5000,
      });
    }).toPass({ timeout: 120_000, intervals: [3000] });

    // Teardown: cancel the workspace's sandbox subscription, then delete it.
    await cancelAndDeleteWorkspace(page, workspaceSlug);
  });
});
