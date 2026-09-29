import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { cancelAndDeleteWorkspace } from "../../helpers/paddle-cleanup";

// Workspace billing-interval switch against the REAL Paddle sandbox (e2e-paddle
// project): buy a monthly Team workspace through sandbox checkout, then switch
// it to yearly billing from the Billing page's Update plan dialog with the
// capacity left untouched, and confirm the rendered plan summary shows yearly.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

// Enable the workspaces feature + verified email for the signed-in user, then
// create a fresh team through the UI and land on its dormant Billing page.
async function createTeamAndOpenBilling(page: Page): Promise<{ workspaceSlug: string }> {
  await page.goto("/feeds");
  await waitForAuthenticatedApp(page);

  const discordUserId = await getDiscordUserIdFromPage(page);
  await enableWorkspacesFeatureInDb(discordUserId);
  await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);
  await page.reload();
  await waitForAuthenticatedApp(page);

  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(`E2E Interval Team ${Date.now()}`);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  const workspaceSlug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(workspaceSlug).toBeTruthy();

  await page
    .getByRole("link", { name: /activate workspace/i })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceSlug}/settings/billing$`));
  await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible({
    timeout: 15000,
  });
  // Prices render only after Paddle.js initializes; waiting for them ensures the
  // subscribe click can actually open the inline checkout.
  await expect(page.getByText(/\/ (month|year)/).first()).toBeVisible({ timeout: 30000 });

  return { workspaceSlug: workspaceSlug as string };
}

// Fill and submit the Paddle checkout the subscribe button opens, then wait for
// the webhook to flip the page to the active current-plan view.
async function completeInlineCheckout(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15000 });

  const paddleFrame = dialog
    .frameLocator('iframe[name*="paddle"], iframe[src*="paddle"]')
    .first();
  const cardInput = paddleFrame.getByRole("textbox", { name: "Card number" });
  await expect(cardInput).toBeVisible({ timeout: 30000 });

  // Fill country/ZIP first so Paddle calculates tax before submission.
  await paddleFrame.getByRole("combobox", { name: "Country" }).selectOption("United States");
  await paddleFrame.getByRole("textbox", { name: "ZIP/Postcode" }).fill("12345");
  await page.waitForTimeout(3000);

  await cardInput.fill("4242424242424242");
  await paddleFrame.getByRole("textbox", { name: "Expiry" }).fill("1230");
  await paddleFrame.getByRole("textbox", { name: "CVV" }).fill("123");
  await paddleFrame.getByRole("textbox", { name: "Card holder" }).fill("Test User");

  const subscribeButton = paddleFrame.getByRole("button", { name: /subscribe now/i });
  await expect(subscribeButton).toBeVisible({ timeout: 5000 });
  await subscribeButton.click();

  // Paddle may recalculate tax after submission; if it asks to click again, do so.
  await page.waitForTimeout(5000);
  const taxMessage = paddleFrame.getByText("Click 'Subscribe now' to try again");
  if (await taxMessage.isVisible().catch(() => false)) {
    await subscribeButton.click();
  }

  await expect(page.getByRole("heading", { name: "Current plan" })).toBeVisible({
    timeout: 120_000,
  });
}

test.describe("Paddle workspace interval switch", () => {
  test("switches a monthly workspace subscription to yearly from the Update plan dialog", async ({
    page,
  }) => {
    test.setTimeout(540_000);

    const { workspaceSlug } = await createTeamAndOpenBilling(page);

    // Subscribe at the default 70 feeds on the default monthly interval.
    await page.getByRole("button", { name: /subscribe to team, 70 feeds total/i }).click();
    await completeInlineCheckout(page);
    await expect(page.getByText("Current plan").first()).toBeVisible({ timeout: 10000 });

    // Fixture check through the rendered UI: the subscription bills monthly.
    await expect(page.getByText(/\/ month/).first()).toBeVisible({ timeout: 30000 });

    // Open the Update plan dialog and switch ONLY the billing interval: the
    // capacity stays at the current 70 feeds.
    await page.getByRole("button", { name: /update plan/i }).click();
    const updateDialog = page.getByRole("dialog");
    await expect(updateDialog.getByRole("heading", { name: "Update plan" })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      updateDialog.getByRole("radiogroup", { name: "Billing interval" }),
    ).toBeVisible({ timeout: 10000 });

    // Chakra RadioCard's hidden radio input is covered by its label (intercepts
    // pointer events), so click the visible card text.
    await updateDialog.getByText("Yearly", { exact: true }).click();

    // The Confirm action stays inert until the change preview resolves, so wait
    // for the prorated preview (or its deferred variant) before committing.
    await expect(
      updateDialog.getByText(/Total due today|No charge today/),
    ).toBeVisible({ timeout: 30000 });
    // The recurring disclosure must already quote the NEW interval.
    await expect(updateDialog.getByText(/\/ year/).first()).toBeVisible({ timeout: 15000 });

    await updateDialog.getByRole("button", { name: /update plan/i }).click();

    // The change request resolves once the backend observes the Paddle webhook
    // (its poll window is ~2 minutes), so let it settle either way before
    // reading the result — same contract as the personal interval switch.
    await expect
      .poll(
        async () =>
          !(await updateDialog.isVisible().catch(() => false)) ||
          (await updateDialog.getByRole("alert").isVisible().catch(() => false)),
        { timeout: 210000, intervals: [2000] },
      )
      .toBe(true);

    // Assert through the rendered UI that the subscription is now billed
    // yearly. The plan summary is rendered from the subscription record on
    // page load, so poll with reloads until the webhook-derived interval
    // renders ("Your plan covers 70 feeds in total at $X / year.").
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(/\/ year/).first()).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 180000 });

    // Teardown: cancel the workspace's sandbox subscription, then delete it.
    await cancelAndDeleteWorkspace(page, workspaceSlug);
  });
});
