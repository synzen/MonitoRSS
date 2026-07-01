import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getTestServerName, getTestChannelName } from "../../helpers/api";

async function navigateToTemplateModal(
  page: Page,
  feedId: string,
  serverName: string,
  channelName: string,
) {
  await page.goto(`/feeds/${feedId}`);
  await expect(page.getByRole("button", { name: /Add connection/i }).first()).toBeVisible({
    timeout: 10000,
  });

  await page
    .getByRole("button", { name: /Add connection/i })
    .first()
    .click();

  await page.locator("#server-select").click();
  await page.locator('[role="option"]').filter({ hasText: serverName }).click();

  await expect(page.getByText("Select a channel")).toBeVisible({ timeout: 15000 });
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

  await page.getByRole("radio", { name: /Send directly to channel/i }).click({ force: true });
  await page.getByRole("button", { name: /Next: Choose Template/i }).click();

  const modal = page.getByTestId("template-selection-modal");
  await expect(modal).toBeVisible({ timeout: 10000 });

  return modal;
}

const UNFURL_NOTE = /Discord may add its own preview card from the link/i;

test.describe("Discord auto-embed disclosure note", () => {
  test("shows the unfurl note for Simple Text, hides it for Rich Embed, and Escape on the popover does not close the gallery dialog", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    test.skip(
      !serverName || !channelName,
      "serverName and channelName must be configured in e2econfig.json",
    );

    const modal = await navigateToTemplateModal(page, testFeed.id, serverName!, channelName!);

    // Simple Text sends a bare link, so the disclosure note must appear.
    await page.getByText("Simple Text").first().click();
    await expect(
      modal.locator("strong").filter({ hasText: "Test Article" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText(UNFURL_NOTE)).toBeVisible({ timeout: 10000 });

    // Open the "why a card might not appear" popover.
    await modal.getByRole("button", { name: /Why a card might not appear/i }).click();
    const popoverReason = page.getByText(/does not provide preview data/i);
    await expect(popoverReason).toBeVisible({ timeout: 5000 });

    // Escape must dismiss ONLY the popover. The gallery dialog must stay open.
    await page.keyboard.press("Escape");
    await expect(popoverReason).toBeHidden({ timeout: 5000 });
    await expect(modal).toBeVisible();

    // Rich Embed is a components-v2 template that suppresses Discord's unfurl,
    // so the note must NOT appear for it.
    await page.getByText("Rich Embed").first().click();
    await expect(modal.getByText(UNFURL_NOTE)).toBeHidden({ timeout: 10000 });
  });
});
