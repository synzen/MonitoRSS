import { test, expect } from "../fixtures/test-fixtures";
import { ensureFreeSubscriptionState } from "../helpers/paddle-cleanup";

const TIER_1_MONTHLY_PRICE_ID = "pri_01hf01yn08hj2jwtywq7fhsww3";

test.describe("Paddle Checkout", () => {
  test.beforeEach(async ({ page }) => {
    await ensureFreeSubscriptionState(page);
  });

  test("can subscribe to Tier 1 via Paddle checkout", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`/paddle-checkout/${TIER_1_MONTHLY_PRICE_ID}`);

    const checkoutHeading = page.getByRole("heading", {
      name: "Checkout Summary",
    });
    await expect(checkoutHeading).toBeVisible({ timeout: 15000 });

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
  });
});
