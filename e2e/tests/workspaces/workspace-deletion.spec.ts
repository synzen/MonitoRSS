import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";

// Stable post-auth element present on every authenticated page regardless of how
// many feeds the user has.
async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Workspace deletion", () => {
  test("owner deletes a workspace after typing its name to confirm", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);
    await page.reload();
    await waitForAuthenticatedApp(page);

    // Create the workspace that will be deleted.
    await page.getByRole("button", { name: /switch workspace/i }).click();
    await page.getByRole("menuitem", { name: /create a workspace/i }).click();
    const createDialog = page.getByRole("dialog");
    const workspaceName = `E2E Deletion ${discordUserId}`;
    await createDialog.getByLabel("Workspace name").fill(workspaceName);
    await createDialog.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
    const workspaceUrl = page.url();

    // Reach the team's settings page the same way a user would: Account
    // Settings -> Your teams -> settings link.
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();
    await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("link", { name: `${workspaceName} settings` }).click();
    await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();

    // The delete section sits at the bottom of the page, below Members.
    await page.getByRole("button", { name: "Delete workspace" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();

    // Confirmation is gated on typing the exact team name; a wrong phrase keeps
    // the destructive action unavailable (aria-disabled, since the button stays
    // focusable for assistive tech).
    const confirmButton = confirmDialog.getByRole("button", { name: "Delete workspace" });
    await expect(confirmButton).toHaveAttribute("aria-disabled", "true");
    const phraseInput = confirmDialog.getByLabel(`Type "${workspaceName}" to confirm`);
    await phraseInput.fill("wrong name");
    await expect(confirmButton).toHaveAttribute("aria-disabled", "true");
    await phraseInput.fill(workspaceName);
    await expect(confirmButton).not.toHaveAttribute("aria-disabled", "true");
    await confirmButton.click();

    // Lands back on the personal dashboard with a persistent alert. Match the
    // visible alert title/description exactly: the page alert also renders an
    // srOnly role="status" live region whose announcement concatenates both
    // ("Workspace deleted. <name> and all of its feeds have been deleted."), so a
    // loose substring match resolves to two elements and trips strict mode.
    await expect(page).toHaveURL(/\/feeds$/, { timeout: 15000 });
    await expect(page.getByText("Workspace deleted", { exact: true })).toBeVisible();
    await expect(
      page.getByText(`${workspaceName} and all of its feeds have been deleted.`, {
        exact: true,
      }),
    ).toBeVisible();

    // Back to zero workspaces: the switcher stays in the header (it's the create
    // entry point in every scope) and returns to the personal scope.
    await expect(
      page.getByRole("button", { name: "Switch workspace, current: Personal" }),
    ).toBeVisible();

    // A stale bookmark to the deleted workspace resolves to the not-found page.
    await page.goto(workspaceUrl);
    await expect(page).toHaveURL(/\/not-found$/, { timeout: 15000 });
  });
});
