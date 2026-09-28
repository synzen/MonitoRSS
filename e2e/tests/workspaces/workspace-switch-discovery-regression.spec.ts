import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { addFeedViaDiscovery } from "../../helpers/discovery";

// Regression: switching from a scope that HAS feeds, to an empty scope (discovery UI),
// then BACK to the scope with feeds must show the feeds table again. The discovery-mode
// state machine only had a has-feeds -> empty transition, never empty -> has-feeds, so
// the second switch left the populated scope stuck showing "no feeds" / the discovery UI.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

async function enableWorkspacesForCurrentUser(page: Page): Promise<void> {
  const discordUserId = await getDiscordUserIdFromPage(page);
  await enableWorkspacesFeatureInDb(discordUserId);
  await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);
  await page.reload();
  await waitForAuthenticatedApp(page);
}

// Creates a workspace from whichever scope is active. "Create a workspace" lives in the
// workspace switcher in every scope, including at 0 workspaces.
async function createWorkspace(page: Page, workspaceName: string): Promise<string> {
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

async function switchToWorkspace(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole("button", { name: /Switch workspace/ }).click();
  await page.getByRole("menuitemradio", { name: workspaceName }).click();
  await expect(
    page.getByRole("button", { name: `Switch workspace, current: ${workspaceName}` }),
  ).toBeVisible();
}

test.describe("Workspace switch discovery regression", () => {
  test("switching from a populated workspace to an empty one and back keeps the feeds visible", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    // Workspace A: add a feed so it renders the feeds table, not discovery.
    const workspaceAName = `E2E Switch A ${Date.now()}`;
    await createWorkspace(page, workspaceAName);
    await addFeedViaDiscovery(page);
    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible();

    // Workspace B: freshly created, zero feeds, so it renders the discovery UI.
    const workspaceBName = `E2E Switch B ${Date.now()}`;
    await createWorkspace(page, workspaceBName);
    await expect(
      page.getByRole("heading", { name: /^Add feeds to / }),
    ).toBeVisible({ timeout: 15000 });

    // Switch back to workspace A. Its feed is still there, so the table must reappear,
    // NOT the discovery UI.
    await switchToWorkspace(page, workspaceAName);

    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: /^Add feeds to / })).toHaveCount(0);
  });
});
