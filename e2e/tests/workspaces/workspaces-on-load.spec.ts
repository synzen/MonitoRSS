import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { createWorkspace } from "../../helpers/api";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";

// Covers the "existing workspace present on initial load" path: the header workspace
// switcher and the Account Settings "Your workspaces" section must render from a
// workspace that already exists in the DB (not one created through the UI in-test).

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Workspaces on initial load", () => {
  test("shows the workspace switcher and Your workspaces for a pre-existing workspace", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);
    const workspaceName = `Load Workspace ${discordUserId}`;
    await createWorkspace(page, {
      name: workspaceName,
      // Full id (all digits) keeps the slug unique — e2e user ids share a prefix.
      slug: `load-workspace-${discordUserId}`,
    });

    await page.reload();
    await waitForAuthenticatedApp(page);

    // The count-gated switcher renders because the user already has a workspace.
    const switcher = page.getByRole("button", { name: /Switch team/ });
    await expect(switcher).toBeVisible();
    await switcher.click();
    await expect(page.getByRole("menuitemradio", { name: workspaceName })).toBeVisible();
    await page.keyboard.press("Escape");

    // The workspace is listed under "Your workspaces" in Account Settings.
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();
    await expect(page.getByRole("heading", { name: "Your teams" })).toBeVisible({
      timeout: 15000,
    });
    // The workspace's Settings link is unique to the "Your workspaces" row.
    await expect(
      page.getByRole("link", { name: `${workspaceName} settings` }),
    ).toBeVisible();
  });
});
