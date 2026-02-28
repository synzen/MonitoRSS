import { test, expect, type Page } from "../fixtures/test-fixtures";
import {
  getTestServerName,
  getTestChannelName,
  getTestChannelId,
} from "../helpers/api";

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

  // Wait for channel dropdown to be ready (placeholder changes when channels load)
  await expect(page.getByText("Select a channel")).toBeVisible({
    timeout: 15000,
  });
  // Focus the channel select input, then press ArrowDown to open menu
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

  // Select a template and wait for preview
  await page.getByText("Simple Text").first().click();
  await expect(
    modal.locator("strong").filter({ hasText: "Test Article" }),
  ).toBeVisible({ timeout: 10000 });

  return modal;
}

test.describe("Branding Fields - Template Gallery Modal", () => {
  test("shows branding fields with preview-only framing and updates preview live", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    test.skip(
      !serverName || !channelName,
      "serverName and channelName must be configured in e2econfig.json",
    );

    const modal = await navigateToTemplateModal(
      page,
      testFeed.id,
      serverName!,
      channelName!,
    );

    // Verify branding fields are visible
    const displayNameInput = modal.getByLabel("Display Name");
    const avatarUrlInput = modal.getByLabel("Avatar URL");
    await expect(displayNameInput).toBeVisible();
    await expect(avatarUrlInput).toBeVisible();

    // Verify "Free plan" framing is shown (free user)
    await expect(modal.getByText(/Free plan/)).toBeVisible();

    // Verify branding fields are interactive (not disabled)
    await expect(displayNameInput).toBeEnabled();
    await expect(avatarUrlInput).toBeEnabled();

    // Type a custom display name and verify preview updates
    await displayNameInput.fill("My Custom Bot");
    await expect(modal.getByText("My Custom Bot")).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows two-button save when free user fills branding fields", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    test.skip(
      !serverName || !channelName,
      "serverName and channelName must be configured in e2econfig.json",
    );

    const modal = await navigateToTemplateModal(
      page,
      testFeed.id,
      serverName!,
      channelName!,
    );

    // Fill in branding display name
    await modal.getByLabel("Display Name").fill("My Custom Bot");

    // Verify two-button save appears
    await expect(
      modal.getByRole("button", { name: "Save without branding" }),
    ).toBeVisible();
    await expect(
      modal.getByRole("button", { name: "Upgrade to save with branding" }),
    ).toBeVisible();
  });

  test("shows inline upgrade prompt and Paddle checkout overlay when clicking upgrade", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    test.skip(
      !serverName || !channelName,
      "serverName and channelName must be configured in e2econfig.json",
    );

    const modal = await navigateToTemplateModal(
      page,
      testFeed.id,
      serverName!,
      channelName!,
    );

    // Fill in branding
    await modal.getByLabel("Display Name").fill("My Custom Bot");

    // Click "Upgrade to save with branding"
    await modal
      .getByRole("button", { name: "Upgrade to save with branding" })
      .click();

    // Verify inline upgrade prompt appears
    const upgradeRegion = modal.getByRole("region", {
      name: "Upgrade to save custom branding",
    });
    await expect(upgradeRegion).toBeVisible();
    await expect(
      upgradeRegion.getByText("Custom branding is included on all paid plans"),
    ).toBeVisible();

    // Verify legal text is present
    await expect(
      upgradeRegion.getByText(/Payments handled by Paddle/),
    ).toBeVisible();

    // Verify "Back to editor" link works
    await upgradeRegion.getByText("Back to editor").click();
    await expect(upgradeRegion).not.toBeVisible();

    // Verify branding values are preserved after returning
    await expect(modal.getByLabel("Display Name")).toHaveValue("My Custom Bot");

    // Go back to upgrade prompt for Paddle test
    await modal
      .getByRole("button", { name: "Upgrade to save with branding" })
      .click();
    await expect(upgradeRegion).toBeVisible();

    // Click "Get Tier 1" to open Paddle checkout overlay
    await upgradeRegion.getByRole("button", { name: /Get Tier 1/ }).click();

    // Verify the Paddle checkout overlay iframe appears
    const paddleFrame = page.locator(
      'iframe[name*="paddle"], iframe[src*="paddle"]',
    );
    await expect(paddleFrame.first()).toBeVisible({ timeout: 15000 });
  });

  test("saves without branding when clicking save without branding", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    test.skip(
      !serverName || !channelName,
      "serverName and channelName must be configured in e2econfig.json",
    );

    const modal = await navigateToTemplateModal(
      page,
      testFeed.id,
      serverName!,
      channelName!,
    );

    // Fill branding then save without it
    await modal.getByLabel("Display Name").fill("My Custom Bot");

    await modal.getByRole("button", { name: "Save without branding" }).click();

    // Connection should save successfully
    await expect(page.getByText("You're all set")).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Branding Fields - Connection Settings", () => {
  test("shows interactive branding fields with preview-only framing and live preview updates", async ({
    page,
    testFeedWithConnection,
  }) => {
    const { feed, connection } = testFeedWithConnection;

    // Navigate to the connection settings page, Message tab
    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}?view=message`,
    );

    // Wait for the page to load by checking for the branding heading
    const brandingHeading = page.getByText("Branding", { exact: true });
    await brandingHeading.scrollIntoViewIfNeeded({ timeout: 15000 });
    await expect(brandingHeading).toBeVisible();

    // Verify "Free plan" framing is shown (free user)
    await expect(page.getByText(/Free plan/)).toBeVisible();

    // Verify fields are interactive (not disabled)
    const displayNameInput = page.getByLabel("Display Name");
    const avatarUrlInput = page.getByLabel("Avatar URL");
    await expect(displayNameInput).toBeEnabled();
    await expect(avatarUrlInput).toBeEnabled();

    // Type a custom name and verify it appears in the preview
    await displayNameInput.fill("My Custom Bot");
    await expect(page.getByText("My Custom Bot")).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows two-button save bar and opens pricing dialog on upgrade click", async ({
    page,
    testFeedWithConnection,
  }) => {
    const { feed, connection } = testFeedWithConnection;

    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}?view=message`,
    );

    // Make the form dirty by modifying an existing form field (text content)
    const textContent = page.getByRole("textbox", { name: "Text Content" });
    await textContent.scrollIntoViewIfNeeded({ timeout: 15000 });
    await textContent.fill("{{title}} modified");

    // Scroll to and fill in branding display name
    const displayNameInput = page.getByLabel("Display Name");
    await displayNameInput.scrollIntoViewIfNeeded();
    await displayNameInput.fill("My Custom Bot");

    // The unsaved changes bar should appear with two buttons (form is dirty + branding filled)
    await expect(
      page.getByRole("button", { name: "Save without branding" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: "Upgrade to save with branding" }),
    ).toBeVisible();

    // Click "Upgrade to save with branding" — should open PricingDialog
    await page
      .getByRole("button", { name: "Upgrade to save with branding" })
      .click();

    // Verify the pricing dialog opens
    await expect(page.getByRole("dialog").getByText("Pricing")).toBeVisible({
      timeout: 10000,
    });
  });
});
