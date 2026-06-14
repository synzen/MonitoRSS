import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

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

// Creates a workspace from whichever scope is active. The "Create team" entry lives in
// the account menu at 0 workspaces and moves into the workspace switcher once one exists,
// so try the switcher first and fall back to the account menu.
async function createWorkspace(page: Page, workspaceName: string): Promise<string> {
  const switcher = page.getByRole("button", { name: /Switch team/ });
  if (await switcher.isVisible().catch(() => false)) {
    await switcher.click();
    await page.getByRole("menuitem", { name: /create team/i }).click();
  } else {
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /create a team/i }).click();
  }
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Team name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  const slug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(slug).toBeTruthy();
  return slug as string;
}

async function switchToWorkspace(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole("button", { name: /Switch team/ }).click();
  await page.getByRole("menuitemradio", { name: workspaceName }).click();
  await expect(
    page.getByRole("button", { name: `Switch team, current: ${workspaceName}` }),
  ).toBeVisible();
}

async function addFeedViaDiscovery(page: Page): Promise<void> {
  // The discovery heading differs by scope ("...to your Discord" personal,
  // "Add feeds for your team" in a workspace), but the search box is the same.
  const search = page.getByRole("textbox", {
    name: "Search popular feeds or paste a URL",
  });
  await expect(search).toBeVisible({ timeout: 15000 });
  await search.fill(MOCK_RSS_FEED_URL);
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await page
    .getByRole("button", { name: /^Add .+ feed$/i })
    .first()
    .click();
  await page.getByRole("button", { name: /View your feeds/ }).click();
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
      page.getByRole("heading", { name: "Add feeds for your team" }),
    ).toBeVisible({ timeout: 15000 });

    // Switch back to workspace A. Its feed is still there, so the table must reappear,
    // NOT the discovery UI.
    await switchToWorkspace(page, workspaceAName);

    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Add feeds for your team" })).toHaveCount(0);
  });
});
