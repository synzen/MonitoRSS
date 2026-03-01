import { test, expect, type Page } from "../fixtures/test-fixtures";
import { getTestServerName, getTestChannelName } from "../helpers/api";
import { ensureFreeSubscriptionState } from "../helpers/paddle-cleanup";

async function navigateToTemplateModal(
  page: Page,
  feedId: string,
  serverName: string,
  channelName: string,
) {
  await page.goto(`/feeds/${feedId}`);
  await expect(
    page.getByRole("button", { name: /Add connection/i }).first(),
  ).toBeVisible({
    timeout: 10000,
  });

  await page
    .getByRole("button", { name: /Add connection/i })
    .first()
    .click();

  await page.locator("#server-select").click();
  await page.locator('[role="option"]').filter({ hasText: serverName }).click();

  await expect(page.getByText("Select a channel")).toBeVisible({
    timeout: 15000,
  });
  await page.locator("#channel-select").focus();
  await page.locator("#channel-select").press("ArrowDown");
  await page
    .locator('[role="option"]')
    .filter({ hasText: channelName })
    .first()
    .click({ timeout: 15000 });

  await page
    .getByRole("radio", { name: /Don't use threads/i })
    .click({ force: true });

  await page.getByRole("button", { name: /Next: Choose Template/i }).click();

  const modal = page.getByTestId("template-selection-modal");
  await expect(modal).toBeVisible({ timeout: 10000 });

  await page.getByText("Simple Text").first().click();
  await expect(
    modal.locator("strong").filter({ hasText: "Test Article" }),
  ).toBeVisible({ timeout: 10000 });

  return modal;
}

test.describe("Paddle Branding Checkout", () => {
  test.beforeEach(async ({ page }) => {
    await ensureFreeSubscriptionState(page);
  });

  test("upgrades via Paddle checkout from branding upgrade prompt and saves with branding", async ({
    page,
    testFeed,
  }) => {
    test.setTimeout(180_000);

    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    test.skip(
      !serverName || !channelName,
      "serverName and channelName must be configured in e2econfig.json",
    );

    // Phase 1: Navigate to template modal
    const modal = await navigateToTemplateModal(
      page,
      testFeed.id,
      serverName!,
      channelName!,
    );

    // Phase 2: Fill branding fields
    const displayNameInput = modal.getByLabel("Display Name");
    const avatarUrlInput = modal.getByLabel("Avatar URL");

    await displayNameInput.fill("E2E Branding Bot");
    await avatarUrlInput.fill("https://i.imgur.com/test-avatar.png");

    await expect(
      modal.getByRole("button", { name: "Save without branding" }),
    ).toBeVisible();
    await expect(
      modal.getByRole("button", { name: "Upgrade to save with branding" }),
    ).toBeVisible();

    // Phase 3: Enter upgrade view
    await modal
      .getByRole("button", { name: "Upgrade to save with branding" })
      .click();

    const upgradeRegion = modal.getByRole("region", {
      name: "Upgrade to save custom branding",
    });
    await expect(upgradeRegion).toBeVisible();
    await expect(
      upgradeRegion.getByText("Custom branding is included on all paid plans"),
    ).toBeVisible();

    // Phase 4: Open Paddle overlay checkout
    await upgradeRegion.getByRole("button", { name: /Get Tier 1/ }).click();

    const paddleFrame = page.locator("iframe").first();
    await expect(paddleFrame).toBeVisible({ timeout: 15000 });

    const paddle = page.frameLocator("iframe").first();

    // Phase 5: Complete Paddle checkout (overlay has two steps)

    // Step 1: "Your details" — fill country + ZIP, then continue
    const countrySelect = paddle.getByRole("combobox", { name: "Country" });
    await expect(countrySelect).toBeVisible({ timeout: 30000 });
    await countrySelect.selectOption("United States");

    const zipInput = paddle.getByRole("textbox", { name: "ZIP/Postcode" });
    await zipInput.fill("12345");

    const continueButton = paddle.getByRole("button", { name: "Continue" });
    await continueButton.click();

    // Step 2: "Payment" — fill card details
    const cardInput = paddle.getByRole("textbox", { name: "Card number" });
    await expect(cardInput).toBeVisible({ timeout: 30000 });

    // Wait for Paddle to finish loading the payment form fully
    await page.waitForTimeout(5000);

    // Paddle overlay card fields need focus + type approach for reliable input.
    // Use evaluate to set value and dispatch events as a fallback.
    async function fillPaddleField(
      locator: ReturnType<typeof paddle.getByRole>,
      value: string,
    ) {
      await locator.click();
      await page.waitForTimeout(300);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await locator.evaluate((el: any, val: string) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          (globalThis as any).HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeInputValueSetter?.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
      await page.waitForTimeout(500);
    }

    await fillPaddleField(cardInput, "4242424242424242");

    const cardHolderInput = paddle.getByRole("textbox", {
      name: "Card holder",
    });
    await cardHolderInput.fill("Test User");

    const expiryInput = paddle.getByRole("textbox", { name: "Expiry" });
    await fillPaddleField(expiryInput, "12/30");

    const cvvInput = paddle.getByRole("textbox", { name: "CVV" });
    await fillPaddleField(cvvInput, "123");

    // Tab out of CVV to trigger final validation
    await cvvInput.press("Tab");
    await page.waitForTimeout(1000);

    const subscribeButton = paddle.getByRole("button", {
      name: /subscribe now/i,
    });
    await expect(subscribeButton).toBeVisible({ timeout: 5000 });
    await subscribeButton.click();

    // Paddle may recalculate tax after submission; if it asks to click again, do so
    await page.waitForTimeout(5000);
    const taxMessage = paddle.getByText("Click 'Subscribe now' to try again");
    if (await taxMessage.isVisible().catch(() => false)) {
      await subscribeButton.click();
    }

    // Phase 6: Wait for Paddle success screen, then close overlay to trigger checkout.completed
    const paddleSuccessText = paddle.getByText(
      /transaction has been completed successfully/i,
    );
    await expect(paddleSuccessText).toBeVisible({ timeout: 60000 });

    const paddleCloseButton = paddle.getByRole("button", { name: "Close" });
    await paddleCloseButton.click();
    await expect(paddleFrame).not.toBeVisible({ timeout: 15000 });

    // Phase 7: Wait for provisioning to complete
    const provisioningText = page.getByText(/Provisioning benefits/i);
    await expect(
      provisioningText.or(modal.getByRole("button", { name: "Save" })),
    ).toBeVisible({ timeout: 60000 });

    if (await provisioningText.isVisible().catch(() => false)) {
      await expect(provisioningText).not.toBeVisible({ timeout: 60000 });
    }

    // Phase 8: Verify modal state preservation
    await expect(modal).toBeVisible();

    await expect(modal.getByRole("button", { name: "Save" })).toBeVisible({
      timeout: 10000,
    });

    await expect(
      modal.getByRole("button", { name: "Save without branding" }),
    ).not.toBeVisible();
    await expect(
      modal.getByRole("button", { name: "Upgrade to save with branding" }),
    ).not.toBeVisible();

    await expect(displayNameInput).toHaveValue("E2E Branding Bot");
    await expect(avatarUrlInput).toHaveValue(
      "https://i.imgur.com/test-avatar.png",
    );

    // Phase 9: Save with branding
    await modal.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("You're all set")).toBeVisible({
      timeout: 10000,
    });
  });
});
