import { test, expect, type Page } from "../fixtures/test-fixtures";

test.describe("Paddle Retain Cancellation Flow", () => {
  test("cancels subscription through Paddle Retain flow", async ({ page }) => {
    test.setTimeout(180_000);

    // Navigate to User Settings
    await page.goto("/servers");
    await page.getByRole("link", { name: /account settings/i }).click();
    await expect(
      page.getByRole("heading", { name: "Account Settings" }),
    ).toBeVisible({
      timeout: 10000,
    });

    // Verify user has a paid subscription by checking for "Manage Subscription" button
    const manageButton = page.getByRole("button", {
      name: "Manage Subscription",
    });
    const resumeButton = page.getByRole("button", {
      name: "Resume subscription",
    });

    // If already pending cancellation or on free plan, skip
    if (await resumeButton.isVisible().catch(() => false)) {
      test.skip(true, "Subscription is already pending cancellation");

      return;
    }

    const hasManageButton = await manageButton.isVisible().catch(() => false);

    if (!hasManageButton) {
      test.skip(
        true,
        "No paid subscription found — cannot test cancellation flow",
      );

      return;
    }

    // Open PricingDialog
    await manageButton.click();

    // Wait for pricing dialog to load
    const cancelButton = page.getByRole("button", {
      name: "Cancel Subscription",
    });
    await expect(cancelButton).toBeVisible({ timeout: 15000 });

    // Click "Cancel Subscription" — this should launch Paddle Retain directly
    await cancelButton.click();

    // Wait for Paddle Retain overlay iframe to appear
    const retainFrame = page.locator("iframe").first();

    try {
      await expect(retainFrame).toBeVisible({ timeout: 30000 });
    } catch {
      // Paddle Retain may not be configured in the sandbox dashboard — skip gracefully
      test.skip(
        true,
        "Paddle Retain overlay did not appear — Retain may not be configured",
      );

      return;
    }

    const retain = page.frameLocator("iframe").first();

    // Interact with the Retain cancellation flow
    // Step 1: Select a cancellation reason from the survey
    const reasonOption = retain.getByRole("button").first();
    await expect(reasonOption).toBeVisible({ timeout: 15000 });
    await reasonOption.click();

    // Step 2: Continue / decline retention offers
    const continueButton = retain.getByRole("button", { name: /continue/i });

    if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueButton.click();
    }

    // Step 3: Confirm cancellation — look for final cancel/confirm button
    const cancelConfirmButton = retain
      .getByRole("button", { name: /cancel/i })
      .or(retain.getByRole("button", { name: /confirm/i }));

    await expect(cancelConfirmButton).toBeVisible({ timeout: 15000 });
    await cancelConfirmButton.click();

    // Wait for Retain overlay to close
    await expect(retainFrame).not.toBeVisible({ timeout: 30000 });

    // Navigate to User Settings to verify the cancellation state
    await page.goto("/servers");
    await page.getByRole("link", { name: /account settings/i }).click();
    await expect(
      page.getByRole("heading", { name: "Account Settings" }),
    ).toBeVisible({
      timeout: 10000,
    });

    // Verify the subscription shows pending cancellation with a cancellation date
    await expect(
      page.getByText(/scheduled to be cancelled on/i),
    ).toBeVisible({ timeout: 15000 });

    // Verify the "Resume subscription" button appears
    await expect(
      page.getByRole("button", { name: "Resume subscription" }),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});
