import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// Per-user feed management invites (the "co-manage" / "transfer ownership" sharing on a
// single feed) are intentionally disabled for workspace feeds — access to a workspace
// feed is governed by workspace membership instead. The "Feed Management Invites"
// section on the feed Settings tab must therefore be absent for a workspace feed, while
// remaining present for a personal feed (the gate is conditional, not a blanket removal).

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

async function createWorkspace(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
}

async function addFeedViaDiscovery(page: Page): Promise<void> {
  // Used in both personal and workspace scope (the discovery heading differs by
  // scope); the search box is scope-agnostic, so use it as the discovery-ready signal.
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

async function openFeedSettingsTab(page: Page): Promise<void> {
  await page.getByRole("link", { name: /^Configure/ }).first().click();
  await expect(page.getByRole("heading", { name: "Feed Overview" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("tab", { name: "Settings" }).click();
  // The Settings tab always renders the Refresh Rate section, so use it to confirm the
  // tab content has mounted before asserting on the (conditionally absent) invites section.
  await expect(page.getByRole("heading", { name: "Refresh Rate" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Workspace feed management invites", () => {
  test("hides the Feed Management Invites section for workspace feeds", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    await createWorkspace(page, `E2E Invites Workspace ${Date.now()}`);
    await addFeedViaDiscovery(page);
    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible();

    await openFeedSettingsTab(page);

    await expect(
      page.getByRole("heading", { name: "Feed Management Invites" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Invite user to/i })).toHaveCount(0);
  });

  test("still shows the Feed Management Invites section for personal feeds", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    // Personal scope — add a feed without entering any workspace.
    await addFeedViaDiscovery(page);
    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible();

    await openFeedSettingsTab(page);

    await expect(
      page.getByRole("heading", { name: "Feed Management Invites" }),
    ).toBeVisible();
  });
});
