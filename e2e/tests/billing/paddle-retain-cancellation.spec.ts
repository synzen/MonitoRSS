import { test, expect } from "../../fixtures/test-fixtures";
import { ensurePaidSubscriptionState } from "../../helpers/paddle-cleanup";
import {
  setCancellationDateInDb,
  getDiscordUserIdFromPage,
} from "../../helpers/paddle-db";

const TIER_1_MONTHLY_PRICE_ID = "pri_01hf01yn08hj2jwtywq7fhsww3";

test.describe("Paddle Subscription Cancellation", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000);
    const userResponse = await page.request.get("/api/v1/users/@me");
    const userData = await userResponse.json();
    await ensurePaidSubscriptionState(page, {
      email: userData.result.email,
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

    await page.route(
      "**/api/v1/subscription-products/cancel",
      async (route) => {
        const userId = await getDiscordUserIdFromPage(page);
        await setCancellationDateInDb(userId);
        await route.fulfill({ status: 204 });
      },
    );

    await confirmDialog
      .getByRole("button", { name: "Confirm Downgrade" })
      .click();

    await expect(confirmDialog).not.toBeVisible({ timeout: 15000 });

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

  test("shows an inline error in the dialog (not a toast) when cancellation fails", async ({
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

    await page.route(
      "**/api/v1/subscription-products/cancel",
      async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            isStandardized: true,
            code: "ADDRESS_LOCATION_NOT_ALLOWED",
            message:
              "Your location is not supported for billing. This may be due to regional restrictions. If you believe this is an error, please contact support@monitorss.xyz.",
            timestamp: Date.now(),
            errors: [],
          }),
        });
      },
    );

    await confirmDialog
      .getByRole("button", { name: "Confirm Downgrade" })
      .click();

    const dialogError = confirmDialog.getByRole("alert");
    await expect(dialogError).toContainText(/location is not supported/i, {
      timeout: 15000,
    });

    await expect(confirmDialog).toBeVisible();
    await expect(
      confirmDialog.getByRole("button", { name: "Cancel" }),
    ).toBeVisible();
  });

  test("returns focus to the triggering button after backing out of the cancellation dialog", async ({
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

    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 15000 });

    await expect(cancelButton).toBeFocused({ timeout: 15000 });
  });
});
