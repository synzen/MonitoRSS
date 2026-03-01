import { test, expect } from "../fixtures/test-fixtures";
import { ensurePaidSubscriptionState } from "../helpers/paddle-cleanup";
import { setCancellationDateInDb } from "../helpers/paddle-db";

const TIER_1_MONTHLY_PRICE_ID = "pri_01hf01yn08hj2jwtywq7fhsww3";
const PADDLE_CUSTOMER_ID = "ctm_01hby2w9dgxrhgzh92a0emjmdc";

test.describe("Paddle Subscription Cancellation", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    await ensurePaidSubscriptionState(page, {
      customerId: PADDLE_CUSTOMER_ID,
      priceId: TIER_1_MONTHLY_PRICE_ID,
    });
  });

  test("cancels subscription and shows pending cancellation state", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await page.goto("/feeds");
    await page.getByRole("button", { name: /account settings/i }).click();
    await page.getByRole("menuitem", { name: "Account Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Account Settings" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Manage Subscription" }).click();

    const cancelButton = page.getByRole("button", {
      name: "Cancel Subscription",
    });
    await expect(cancelButton).toBeVisible({ timeout: 15000 });
    await cancelButton.click();

    const confirmDialog = page.getByRole("dialog", {
      name: "Confirm Subscription Changes",
    });
    await expect(confirmDialog).toBeVisible({ timeout: 30000 });

    // Intercept the cancel API call since simulated subscriptions cannot be
    // cancelled through the real Paddle API. Return 204 and write the
    // cancellation state directly to the DB (mimicking the webhook).
    await page.route(
      "**/api/v1/subscription-products/cancel",
      async (route) => {
        await setCancellationDateInDb();
        await route.fulfill({ status: 204 });
      },
    );

    await confirmDialog
      .getByRole("button", { name: "Confirm Downgrade" })
      .click();

    await expect(confirmDialog).not.toBeVisible({ timeout: 15000 });

    // Verify cancellation state on Account Settings page
    await page.goto("/feeds");
    await page.getByRole("button", { name: /account settings/i }).click();
    await page.getByRole("menuitem", { name: "Account Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Account Settings" }),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/scheduled to be cancelled on/i)).toBeVisible({
      timeout: 15000,
    });

    await expect(
      page.getByRole("button", { name: "Resume subscription" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
