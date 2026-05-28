import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getTestServerName, getTestChannelName } from "../../helpers/api";

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
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  await page
    .locator('[role="option"]')
    .filter({ hasText: channelName })
    .first()
    .click({ timeout: 15000 });

  await page
    .getByRole("radio", { name: /Send directly to channel/i })
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

test.describe("Branding Fields - Paddle Overlay", () => {
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

    await modal.getByLabel("Display Name").fill("My Custom Bot");

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

    await expect(
      upgradeRegion.getByText(/Payments handled by Paddle/),
    ).toBeVisible();

    await expect(
      upgradeRegion.getByRole("button", { name: "Save without branding" }),
    ).toBeVisible();

    await upgradeRegion.getByText("Back to editor").click();
    await expect(upgradeRegion).not.toBeVisible();

    await expect(modal.getByLabel("Display Name")).toHaveValue("My Custom Bot");

    await modal
      .getByRole("button", { name: "Upgrade to save with branding" })
      .click();
    await expect(upgradeRegion).toBeVisible();

    await upgradeRegion.getByRole("button", { name: /Get Tier 1/ }).click();

    const paddleFrame = page.locator(
      'iframe[name*="paddle"], iframe[src*="paddle"]',
    );
    await expect(paddleFrame.first()).toBeVisible({ timeout: 15000 });
  });
});
