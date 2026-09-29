import { test, expect } from "../../fixtures/test-fixtures";
import { ensureFreeSubscriptionState } from "../../helpers/paddle-cleanup";

const TIER_1_MONTHLY_PRICE_ID = "pri_01hf01yn08hj2jwtywq7fhsww3";

test.describe("Personal billing interval switch", () => {
  test.beforeEach(async ({ page }) => {
    await ensureFreeSubscriptionState(page);
  });

  test("switches a monthly Personal subscription to yearly from the pricing dialog", async ({
    page,
  }) => {
    test.setTimeout(420_000);

    // The subscription must exist as a REAL Paddle entity for the change
    // preview/update APIs to work (simulated subscriptions 404 on every Paddle
    // API call), so it is created through the sandbox checkout rather than the
    // simulation helper.
    await page.goto(`/paddle-checkout/${TIER_1_MONTHLY_PRICE_ID}`);

    const checkoutHeading = page.getByRole("heading", {
      name: "Checkout Summary",
    });
    await expect(checkoutHeading).toBeVisible({ timeout: 15000 });

    // Wait for checkout data to load (product name appears after Paddle data loads)
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

    await page.goto("/feeds");
    await page.getByRole("button", { name: /account settings/i }).click();
    await page.getByRole("menuitem", { name: "Account Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Account Settings" }),
    ).toBeVisible({ timeout: 10000 });

    // Fixture check through the rendered UI: the new subscription is billed
    // monthly before the switch.
    await expect(page.getByText(/billed .* every month/i)).toBeVisible({
      timeout: 20000,
    });

    await page.getByRole("button", { name: "Manage Subscription" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Pricing", level: 1 }),
    ).toBeVisible({ timeout: 15000 });

    const forYou = dialog.getByRole("region", { name: /^for you$/i });

    // While the monthly interval is selected, the current plan is locked out.
    const currentPlan = forYou.getByRole("button", { name: "Current plan" });
    await expect(currentPlan).toBeVisible();
    await expect(currentPlan).toHaveAttribute("aria-disabled", "true");

    // The regression this guards: toggling to yearly used to leave the Personal
    // card locked on "Current plan" with no way to switch the billing interval.
    // Chakra's switch renders the named input as visually hidden inside its
    // interactive root, so click the root (the input's parent) rather than the
    // invisible input itself.
    const yearlyToggle = dialog
      .getByRole("checkbox", { name: "Switch to yearly pricing" })
      .locator("..");
    await yearlyToggle.click();

    const switchCta = forYou.getByRole("button", { name: /switch to yearly billing/i });
    await expect(switchCta).toBeVisible({ timeout: 15000 });
    await expect(switchCta).toBeEnabled();

    await switchCta.click();

    const confirmDialog = page.getByRole("dialog", {
      name: "Confirm Subscription Changes",
    });
    await expect(confirmDialog).toBeVisible({ timeout: 30000 });

    // The Confirm action stays inert until the change preview resolves, so wait
    // for the preview's totals before clicking.
    await expect(confirmDialog.getByText("Due Today")).toBeVisible({ timeout: 30000 });
    await confirmDialog.getByRole("button", { name: /confirm payment/i }).click();

    // The change request resolves once the backend observes the Paddle webhook,
    // which the sandbox can deliver slower than the backend's poll window — in
    // that case the dialog shows an error even though Paddle applied the
    // change. Let the request settle either way before reading the result.
    await expect
      .poll(
        async () =>
          !(await confirmDialog.isVisible().catch(() => false)) ||
          (await confirmDialog.getByRole("alert").isVisible().catch(() => false)),
        { timeout: 90000, intervals: [2000] },
      )
      .toBe(true);

    // Assert through the rendered UI that the subscription is now billed
    // yearly. The billing text is rendered from the subscription record on page
    // load, so poll with reloads until the webhook-derived interval renders.
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(/billed .* every year/i)).toBeVisible({
        timeout: 5000,
      });
    }).toPass({ timeout: 180000 });
  });
});
