import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/test-fixtures";
import { ensureFreeSubscriptionState } from "../../helpers/paddle-cleanup";

const TIER_3_MONTHLY_PRICE_ID = "pri_01hbkj52vhxyayd7pdcezjvmmm";

// The update flow PATCHes the real subscription in Paddle, so a simulated
// (webhook-only) subscription is not enough — subscribe through the real
// sandbox checkout first.
async function subscribeToTier3(page: Page) {
  await page.goto(`/paddle-checkout/${TIER_3_MONTHLY_PRICE_ID}`);

  const checkoutHeading = page.getByRole("heading", {
    name: "Checkout Summary",
  });
  await expect(checkoutHeading).toBeVisible({ timeout: 15000 });

  await expect(page.getByText(/(Monthly|Annual)/)).toBeVisible({
    timeout: 30000,
  });

  const paddleFrame = page.frameLocator("iframe").first();

  const cardInput = paddleFrame.getByRole("textbox", {
    name: "Card number",
  });
  await expect(cardInput).toBeVisible({ timeout: 30000 });

  // Fill country/ZIP first so Paddle calculates tax before we submit
  const countrySelect = paddleFrame.getByRole("combobox", {
    name: "Country",
  });
  await countrySelect.selectOption("United States");

  const zipInput = paddleFrame.getByRole("textbox", {
    name: "ZIP/Postcode",
  });
  await zipInput.fill("12345");

  // Wait for Paddle to finish tax calculation
  await page.waitForTimeout(3000);

  await cardInput.fill("4242424242424242");

  const expiryInput = paddleFrame.getByRole("textbox", { name: "Expiry" });
  await expiryInput.fill("1230");

  const cvvInput = paddleFrame.getByRole("textbox", { name: "CVV" });
  await cvvInput.fill("123");

  const cardHolderInput = paddleFrame.getByRole("textbox", {
    name: "Card holder",
  });
  await cardHolderInput.fill("Test User");

  const subscribeButton = paddleFrame.getByRole("button", {
    name: /subscribe now/i,
  });
  await expect(subscribeButton).toBeVisible({ timeout: 5000 });
  await subscribeButton.click();

  // Paddle may recalculate tax after submission; if it asks to click again, do so
  await page.waitForTimeout(5000);
  const taxMessage = paddleFrame.getByText(
    "Click 'Subscribe now' to try again",
  );
  if (await taxMessage.isVisible().catch(() => false)) {
    await subscribeButton.click();
  }

  const successHeading = page.getByRole("heading", {
    name: "Your benefits have been provisioned.",
  });
  await expect(successHeading).toBeVisible({ timeout: 60000 });
}

async function goToAccountSettings(page: Page) {
  await page.goto("/feeds");
  await page.getByRole("button", { name: /account settings/i }).click();
  await page.getByRole("menuitem", { name: "Account Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Account Settings" }),
  ).toBeVisible({ timeout: 10000 });
}

async function openPricingDialog(page: Page) {
  await page.getByRole("button", { name: "Manage Subscription" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Pricing", level: 1 }),
  ).toBeVisible({ timeout: 15000 });
}

// Addon changes reach the backend via Paddle webhook, so the rendered
// subscription text lags the confirmed change; reload until it reflects it.
async function expectSubscriptionText(page: Page, pattern: RegExp) {
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(pattern)).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 90000, intervals: [3000] });
}

test.describe("Paddle additional feeds quantity", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    await ensureFreeSubscriptionState(page);
  });

  test("adds and removes additional feeds on an existing Tier 3 subscription", async ({
    page,
  }) => {
    test.setTimeout(420_000);

    await subscribeToTier3(page);

    await goToAccountSettings(page);
    await openPricingDialog(page);

    const tier3Card = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Tier 3" }) });
    const increaseButton = tier3Card.getByRole("button", {
      name: "Increase additional feeds",
    });
    const decreaseButton = tier3Card.getByRole("button", {
      name: "Decrease additional feeds",
    });
    const quantityInput = tier3Card.getByRole("spinbutton");

    // Wait for Paddle price previews so the card is fully rendered before
    // asserting which action button it shows
    await expect(increaseButton).toBeVisible({ timeout: 30000 });
    await expect(tier3Card.getByText(/Add more feeds for .+ each/)).toBeVisible(
      { timeout: 30000 },
    );

    // A subscriber with no addons must see "Current Plan", not a phantom
    // update offering to buy 1 additional feed
    await expect(
      tier3Card.getByRole("button", { name: "Current Plan" }),
    ).toBeVisible();
    await expect(
      tier3Card.getByRole("button", { name: "Update Plan" }),
    ).not.toBeVisible();

    // Add 2 additional feeds
    await increaseButton.click();
    await increaseButton.click();
    await expect(quantityInput).toHaveValue("2");

    const updateButton = tier3Card.getByRole("button", {
      name: "Update Plan",
    });
    await expect(updateButton).toBeVisible();
    await updateButton.click();

    const confirmDialog = page.getByRole("dialog", {
      name: "Confirm Subscription Changes",
    });
    await expect(confirmDialog).toBeVisible({ timeout: 30000 });
    await expect(confirmDialog.getByText("+ 2 additional feeds")).toBeVisible({
      timeout: 30000,
    });

    await confirmDialog
      .getByRole("button", { name: "Confirm Payment" })
      .click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 60000 });

    await expectSubscriptionText(
      page,
      /You are currently on Tier 3 \+ 2 additional feeds/,
    );

    // Remove all additional feeds again
    await openPricingDialog(page);

    await expect(quantityInput).toHaveValue("2", { timeout: 30000 });
    await decreaseButton.click();
    await decreaseButton.click();
    await expect(quantityInput).toHaveValue("0");

    await expect(updateButton).toBeVisible();
    await updateButton.click();

    await expect(confirmDialog).toBeVisible({ timeout: 30000 });
    // Wait for the change preview to finish loading before asserting on content
    await expect(confirmDialog.getByText("Due Today")).toBeVisible({
      timeout: 30000,
    });
    // Going to zero must drop the addon entirely, not sneak in quantity 1
    await expect(confirmDialog.getByText(/additional feed/)).not.toBeVisible();

    await confirmDialog
      .getByRole("button", { name: "Confirm Payment" })
      .click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 60000 });

    await expectSubscriptionText(
      page,
      /You are currently on Tier 3 \(billed every month\)/,
    );
    await expect(page.getByText(/additional feed/)).not.toBeVisible();
  });
});
