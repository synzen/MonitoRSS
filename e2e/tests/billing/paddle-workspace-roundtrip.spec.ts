import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
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
async function createTeamAndOpenBilling(page: Page): Promise<string> {
  await page.goto("/feeds");
  await waitForAuthenticatedApp(page);

  const discordUserId = await getDiscordUserIdFromPage(page);
  await enableWorkspacesFeatureInDb(discordUserId);
  await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);
  await page.reload();
  await waitForAuthenticatedApp(page);

  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /create a team/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Team name").fill(`E2E Paddle Team ${Date.now()}`);
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  const workspaceSlug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(workspaceSlug).toBeTruthy();

  await expect(
    page.getByRole("heading", { name: /Activate your team to start adding feeds/i }),
  ).toBeVisible({ timeout: 15000 });

  await page
    .getByRole("link", { name: /activate team/i })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceSlug}/settings/billing$`));
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 15000 });
  // Prices render only after Paddle.js initializes; waiting for them ensures the
  // subscribe click can actually open the overlay.
  await expect(page.getByText(/\/ (month|year)/).first()).toBeVisible({ timeout: 30000 });

  return workspaceSlug as string;
}

// Fill and submit the Paddle overlay checkout that the subscribe button opens,
// then wait for the webhook to flip the page to the active current-plan view.
async function completeOverlayCheckout(page: Page): Promise<void> {
  // The overlay iframe is not the page's only iframe — target it explicitly.
  const overlayIframe = page.locator('iframe[name*="paddle"], iframe[src*="paddle"]');
  await expect(overlayIframe.first()).toBeVisible({ timeout: 15000 });

  const paddleFrame = page.frameLocator('iframe[name*="paddle"], iframe[src*="paddle"]').first();
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

    const workspaceSlug = await createTeamAndOpenBilling(page);

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
      await firstSubscribe.elementHandle(),
    );
    expect(termsBeforeSubscribe).toBe(true);

    // Subscribe to Tier 2 (monthly default): opens the Paddle overlay checkout.
    await page.getByRole("button", { name: /subscribe to tier 2/i }).click();
    await completeOverlayCheckout(page);

    // The current-plan view renders the tier name both as a card heading and in
    // the "Current plan" badge region, so scope to the heading to stay unique.
    await expect(page.getByRole("heading", { name: "Tier 2" })).toBeVisible();

    // Change-plan confirmation discloses the prorated amount AND the recurring
    // charge before committing. Open the Tier 3 switch and assert the dialog
    // renders the price anchor, the itemized "Due today" breakdown, and the
    // recurring "Then" line, all driven by the real Paddle proration preview.
    const changeDialog = page.getByRole("dialog");
    // The activation transaction may still be processing when we open the
    // switch; Paddle then rejects the proration preview with
    // "subscription_credit_creation_against_processing_transaction" (a 400 the
    // UI surfaces as "Failed to load change preview"). Re-open the dialog until
    // the transaction settles and the preview resolves.
    await expect(async () => {
      if ((await changeDialog.count()) > 0) {
        await changeDialog.getByRole("button", { name: "Cancel" }).click();
        await expect(changeDialog).toHaveCount(0);
      }

      await page.getByRole("button", { name: /switch to tier 3/i }).click();
      await expect(changeDialog.getByText("Confirm plan change")).toBeVisible();
      await expect(changeDialog.getByText("Total due today")).toBeVisible({ timeout: 15000 });
    }).toPass({ timeout: 120_000, intervals: [5000] });

    // Before -> after framing names both tiers.
    await expect(changeDialog.getByText(/Tier 2 \(70 feeds\)/)).toBeVisible();
    await expect(changeDialog.getByText(/Tier 3 \(140 feeds\)/)).toBeVisible();
    // Itemized due-today block, from the live Paddle proration preview.
    await expect(changeDialog.getByText("Subtotal")).toBeVisible();
    await expect(changeDialog.getByText("Tax")).toBeVisible();
    // The compliance-critical recurring disclosure.
    await expect(changeDialog.getByText("Then")).toBeVisible();
    await expect(changeDialog.getByText(/\/ month, starting/)).toBeVisible();
    await expect(changeDialog.getByText(/Renews automatically\. Cancel anytime\./)).toBeVisible();
    // Dismiss without switching: this run only verifies the disclosure, and the
    // teardown cancels the Tier 2 subscription it already created.
    await changeDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(changeDialog).toHaveCount(0);

    // The dormant CTA is gone and a feed can be added through the UI.
    await page.getByRole("button", { name: /Switch team/ }).click();
    await page.getByRole("menuitemradio", { name: /e2e paddle team/i }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceSlug}/feeds$`));
    await expect(
      page.getByRole("heading", { name: /Activate your team to start adding feeds/i }),
    ).toHaveCount(0);
    await expect(page.getByText("This team is not subscribed")).toHaveCount(0);

    await expect(
      page.getByRole("heading", { name: "Get news delivered to your Discord" }),
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

    // Teardown: deleting the workspace cancels the sandbox subscription so the
    // Paddle sandbox does not accumulate live subscriptions across runs.
    const deleteRes = await page.request.delete(`/api/v1/workspaces/${workspaceSlug}`);
    expect(deleteRes.status()).toBe(204);
  });

  test("adds extra feeds to a Tier 3 team and the new limit is reflected in the UI", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const workspaceSlug = await createTeamAndOpenBilling(page);

    // Activate on Tier 3 ANNUAL: adding feeds immediately afterwards prorates
    // the addon over the remaining period, which on a monthly plan can fall
    // under Paddle's $0.70 minimum and be rejected. A year comfortably clears
    // it, so the addon change preview is deterministic.
    await page.getByRole("button", { name: "Yearly" }).click();
    await page.getByRole("button", { name: /subscribe to tier 3/i }).click();
    await completeOverlayCheckout(page);
    await expect(page.getByRole("heading", { name: "Tier 3" })).toBeVisible();

    // The Tier 3 card in the change-plan section carries the additional-feeds
    // control. Scope to that card so the stepper/price assertions stay unique.
    const tier3Card = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Tier 3" }) });
    const stepper = tier3Card.getByRole("spinbutton", { name: /additional feeds/i });
    await expect(stepper).toBeVisible({ timeout: 30000 });
    // A subscriber with no addons sees the bare limit, not a phantom +1.
    await expect(tier3Card.getByText("140 feeds", { exact: false })).toBeVisible();

    // Choosing 2 extra feeds updates the displayed total live, and the headline
    // price recomputes from Paddle (different from the bare-tier price). The
    // headline is the price paragraph carrying both the amount and "/ year"
    // (the feed-count line has no currency), so match on that combined text.
    const priceHeadline = tier3Card.getByText(/\$.*\/ year/).first();
    const barePrice = (await priceHeadline.textContent())?.trim();
    await stepper.fill("2");
    await expect(tier3Card.getByText("142 feeds (140 + 2)")).toBeVisible({ timeout: 30000 });
    await expect(async () => {
      const updatedPrice = (await priceHeadline.textContent())?.trim();
      expect(updatedPrice).not.toEqual(barePrice);
    }).toPass({ timeout: 30000, intervals: [2000] });

    // Confirm the change. The activation transaction may still be processing,
    // so re-open the dialog until Paddle's proration preview resolves (same
    // in-flight-transaction race as the tier switch above).
    const changeDialog = page.getByRole("dialog");
    await expect(async () => {
      if ((await changeDialog.count()) > 0) {
        await changeDialog.getByRole("button", { name: "Cancel" }).click();
        await expect(changeDialog).toHaveCount(0);
      }

      await tier3Card.getByRole("button", { name: /update additional feeds/i }).click();
      await expect(changeDialog.getByText("Confirm plan change")).toBeVisible();
      await expect(changeDialog.getByText("Total due today")).toBeVisible({ timeout: 15000 });
    }).toPass({ timeout: 120_000, intervals: [5000] });

    await changeDialog.getByRole("button", { name: /confirm change/i }).click();
    await expect(changeDialog).toHaveCount(0, { timeout: 60000 });

    // The addon change lands via webhook, so the rendered current-plan text lags
    // the confirmed change; reload until it reflects the 2 extra feeds.
    await expect(async () => {
      await page.reload();
      await expect(page.getByText("Additional feeds: 2")).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 120_000, intervals: [3000] });

    // Teardown: deleting the workspace cancels the sandbox subscription.
    const deleteRes = await page.request.delete(`/api/v1/workspaces/${workspaceSlug}`);
    expect(deleteRes.status()).toBe(204);
  });
});
