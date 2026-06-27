import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";

// There is no /workspaces page. Switching lives in a count-gated header
// workspace switcher; at 0 workspaces the only entry to create one is the account
// (avatar) menu's "Create a workspace" item.

// Stable post-auth element present on every authenticated page regardless of how
// many feeds the user has (a fresh user sees the zero-feed onboarding view, which
// has no "Add Feed" button — so we wait on the header instead).
async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Workspaces", () => {
  test("creates a workspace from the switcher and lands in workspace scope", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);
    await page.reload();
    await waitForAuthenticatedApp(page);

    // The switcher is present even at 0 workspaces, and "Create a workspace" lives
    // inside it.
    await page.getByRole("button", { name: /switch workspace/i }).click();
    await page.getByRole("menuitem", { name: /create a workspace/i }).click();

    const dialog = page.getByRole("dialog");
    const workspaceName = `E2E Workspace ${discordUserId}`;
    await dialog.getByLabel("Workspace name").fill(workspaceName);
    await dialog.getByRole("button", { name: "Create workspace" }).click();

    // Redirected into the workspace — a fresh workspace has no feeds, so the
    // scoped feeds page renders the discovery UI with the workspace heading.
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Add feeds for your workspace" }),
    ).toBeVisible();

    // The switcher now exists in the header and reflects the active workspace.
    await expect(
      page.getByRole("button", { name: `Switch workspace, current: ${workspaceName}` }),
    ).toBeVisible();

    // The workspace is also listed under "Your workspaces" in Account Settings
    // (upgrade path B), with a working Settings link into its settings page.
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();
    await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("link", { name: `${workspaceName} settings` }).click();
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/settings$/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
  });

  test("gates workspace creation behind email verification when no verified email exists", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    // Deliberately no verified email.
    await page.reload();
    await waitForAuthenticatedApp(page);

    await page.getByRole("button", { name: /switch workspace/i }).click();
    await page.getByRole("menuitem", { name: /create a workspace/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Email address")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /send code/i })).toBeVisible();
    // The name form / create action is not reachable until an email is verified.
    await expect(dialog.getByLabel("Workspace name")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Create workspace" })).toHaveCount(0);
  });

  test("exposes the workspaces UI to every user without a feature flag", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    // No workspaces flag seeded for this user: workspaces are on for everyone.

    // The switcher is in the header, and the "Your workspaces" section is on the
    // account settings page.
    await expect(page.getByRole("button", { name: /switch workspace/i })).toBeVisible();
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();
    await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible();
  });

  test("leaves the personal feeds dashboard unchanged", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await expect(page).toHaveURL(/\/feeds$/);
  });
});
