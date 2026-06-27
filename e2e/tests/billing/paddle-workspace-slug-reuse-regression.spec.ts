import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { cancelAndDeleteWorkspace } from "../../helpers/paddle-cleanup";

// Regression for the workspace billing bug: deleting a workspace left the
// per-slug workspace detail in the React Query cache. Recreating a workspace
// with the SAME name (so the freed slug is reused) then served the deleted
// workspace's id from cache, which flowed into the Paddle checkout custom_data.
// The webhook then logged "Ignoring subscription event for missing workspace"
// and the customer was charged with no workspace showing the subscription.
//
// This drives the exact sequence through the UI WITHOUT a page reload between
// delete and recreate (a reload would clear the in-memory cache and mask the
// bug), then completes a real sandbox checkout and asserts the NEW workspace's
// Billing page flips to the active "Current plan" view. That only happens if the
// checkout carried the new workspace id, so it fails if the stale id returns.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

async function createWorkspaceByName(page: Page, workspaceName: string): Promise<string> {
  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  const slug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(slug).toBeTruthy();

  return slug as string;
}

// Delete the current workspace through the UI. Stays client-side (no reload) so
// the React Query cache survives into the recreate step.
async function deleteCurrentWorkspaceViaUi(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /account settings/i }).click();
  await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: `${workspaceName} settings` }).click();
  await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();

  await page.getByRole("button", { name: "Delete workspace" }).click();
  const confirmDialog = page.getByRole("alertdialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByLabel(`Type "${workspaceName}" to confirm`).fill(workspaceName);
  await confirmDialog.getByRole("button", { name: "Delete workspace" }).click();

  await expect(page).toHaveURL(/\/feeds$/, { timeout: 15000 });
  await expect(page.getByText("Workspace deleted")).toBeVisible();
}

// Navigate from the recreated workspace's dormant feeds page to its Billing page
// and wait for Paddle prices to render.
async function openBillingForCurrentWorkspace(page: Page, slug: string): Promise<void> {
  await expect(
    page.getByRole("heading", { name: /Activate your workspace to start adding feeds/i }),
  ).toBeVisible({ timeout: 15000 });
  await page
    .getByRole("link", { name: /activate workspace/i })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/settings/billing$`));
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/\/ (month|year)/).first()).toBeVisible({ timeout: 30000 });
}

async function completeInlineCheckout(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15000 });

  const overlayIframe = dialog.locator('iframe[name*="paddle"], iframe[src*="paddle"]');
  await expect(overlayIframe.first()).toBeVisible({ timeout: 15000 });

  const paddleFrame = dialog
    .frameLocator('iframe[name*="paddle"], iframe[src*="paddle"]')
    .first();
  const cardInput = paddleFrame.getByRole("textbox", { name: "Card number" });
  await expect(cardInput).toBeVisible({ timeout: 30000 });

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

  await page.waitForTimeout(5000);
  const taxMessage = paddleFrame.getByText("Click 'Subscribe now' to try again");
  if (await taxMessage.isVisible().catch(() => false)) {
    await subscribeButton.click();
  }

  await expect(page.getByRole("heading", { name: "Current plan" })).toBeVisible({
    timeout: 120_000,
  });
}

test.describe("Paddle workspace slug-reuse regression", () => {
  test("a workspace recreated with a reused slug subscribes to itself, not the deleted one", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    const verifiedEmail = `verified-${discordUserId}@example.com`;
    await setVerifiedEmailInDb(discordUserId, verifiedEmail);
    await page.reload();
    await waitForAuthenticatedApp(page);

    // The same name across both creations guarantees the slug is reused, which is
    // what triggered the stale-cache id. A Date stamp keeps it unique per run.
    const workspaceName = `E2E Slug Reuse ${Date.now()}`;

    // 1) Create, then 2) delete the first workspace (dormant, so deletion is
    // allowed). No reload after this point: the cache must persist into recreate.
    const firstSlug = await createWorkspaceByName(page, workspaceName);
    await deleteCurrentWorkspaceViaUi(page, workspaceName);

    // 3) Recreate with the same name -> the freed slug is reused.
    const secondSlug = await createWorkspaceByName(page, workspaceName);
    expect(secondSlug).toBe(firstSlug);

    // 4) Subscribe through the real sandbox checkout from the recreated workspace.
    await openBillingForCurrentWorkspace(page, secondSlug);
    await page.getByRole("button", { name: /subscribe to team, 70 feeds total/i }).click();
    await completeInlineCheckout(page);

    // 5) The page flips to the active current-plan view only if the webhook
    // attached the subscription to THIS workspace. With the bug, the checkout
    // carried the deleted workspace's id, the webhook ignored the event as a
    // missing workspace, and this never appears.
    await expect(page.getByText("Current plan").first()).toBeVisible();
    await expect(page.getByText("70 feeds").first()).toBeVisible();
    await expect(page.getByText(verifiedEmail)).toBeVisible({ timeout: 30000 });

    // Teardown: cancel the sandbox subscription, then delete the workspace.
    await cancelAndDeleteWorkspace(page, secondSlug);
  });
});
