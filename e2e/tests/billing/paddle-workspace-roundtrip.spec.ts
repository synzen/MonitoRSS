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

test.describe("Paddle workspace roundtrip", () => {
  test("dormant workspace activates through sandbox checkout and can add a feed", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);
    await page.reload();
    await waitForAuthenticatedApp(page);

    // Create the workspace through the UI.
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /create a team/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Team name").fill(`E2E Paddle Team ${Date.now()}`);
    await dialog.getByRole("button", { name: "Create team" }).click();
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
    const workspaceSlug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
    expect(workspaceSlug).toBeTruthy();

    // Dormant landing: the activation CTA is the feeds page's empty state.
    await expect(
      page.getByRole("heading", { name: /Activate your team to start adding feeds/i }),
    ).toBeVisible({ timeout: 15000 });

    // Deep link to the Billing page (checkout is hosted on the page, never in
    // a modal dialog, so the Paddle overlay stays interactable).
    await page
      .getByRole("link", { name: /activate team/i })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceSlug}/settings/billing$`));
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 15000 });

    // Prices render only after Paddle.js initializes; waiting for them ensures
    // the subscribe click can actually open the overlay.
    await expect(page.getByText(/\/ month/).first()).toBeVisible({ timeout: 30000 });

    // Subscribe to Tier 2: opens the Paddle overlay checkout.
    await page.getByRole("button", { name: /subscribe to tier 2/i }).click();

    // The overlay iframe is not the page's only iframe — target it explicitly.
    const overlayIframe = page.locator('iframe[name*="paddle"], iframe[src*="paddle"]');
    await expect(overlayIframe.first()).toBeVisible({ timeout: 15000 });

    const paddleFrame = page
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

    // The webhook activates the workspace; the Billing page polls the
    // workspace read and flips to the current-plan view without user action.
    await expect(page.getByRole("heading", { name: "Current plan" })).toBeVisible({
      timeout: 120_000,
    });
    // The current-plan view renders the tier name both as a card heading and in
    // the "Current plan" badge region, so scope to the heading to stay unique.
    await expect(page.getByRole("heading", { name: "Tier 2" })).toBeVisible();

    // Change-plan confirmation discloses the prorated amount AND the recurring
    // charge before committing. Open the Tier 3 switch and assert the dialog
    // renders the price anchor, the itemized "Due today" breakdown, and the
    // recurring "Then" line, all driven by the real Paddle proration preview.
    await page.getByRole("button", { name: /switch to tier 3/i }).click();
    const changeDialog = page.getByRole("dialog");
    await expect(changeDialog.getByText("Confirm plan change")).toBeVisible();
    // Before -> after framing names both tiers.
    await expect(changeDialog.getByText(/Tier 2 \(70 feeds\)/)).toBeVisible();
    await expect(changeDialog.getByText(/Tier 3 \(140 feeds\)/)).toBeVisible();
    // Itemized due-today block. The amount comes from a live Paddle proration
    // preview round-trip, which can run slow under sandbox latency, so give it a
    // generous budget rather than racing the spinner.
    await expect(changeDialog.getByText("Total due today")).toBeVisible({ timeout: 60000 });
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
});
