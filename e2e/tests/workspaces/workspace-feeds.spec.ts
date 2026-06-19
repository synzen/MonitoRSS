import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// Workspace-scoped feeds reuse the personal feeds dashboard verbatim (discovery UI
// + bulk add). A feed added while in workspace scope belongs to the workspace,
// navigation stays under /workspaces/:slug, and workspace feeds never appear in
// personal scope.

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
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
}

async function addFeedViaDiscovery(page: Page): Promise<void> {
  // 0 workspace feeds -> the page renders the discovery UI, with the workspace-scoped
  // heading (personal scope uses "Get news delivered to your Discord").
  await expect(
    page.getByRole("heading", { name: "Add feeds for your workspace" }),
  ).toBeVisible({ timeout: 15000 });
  const search = page.getByRole("textbox", {
    name: "Search popular feeds or paste a URL",
  });
  await search.fill(MOCK_RSS_FEED_URL);
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await page
    .getByRole("button", { name: /^Add .+ feed$/i })
    .first()
    .click();
  await page.getByRole("button", { name: /View your feeds/ }).click();
}

test.describe("Workspace feeds", () => {
  test("adds a feed via the discovery UI and keeps navigation workspace-scoped", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    await createWorkspace(page, `E2E Feeds Workspace ${Date.now()}`);
    const slug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
    expect(slug).toBeTruthy();

    await addFeedViaDiscovery(page);

    // Back on the workspace feeds table (still workspace-scoped) with the feed listed.
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`));
    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible();

    // Bulk add ("Add multiple feeds") is available and stays workspace-scoped.
    await page.getByRole("button", { name: /Additional add feed options/i }).click();
    await page.getByRole("menuitem", { name: /add multiple feeds/i }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/add-feeds$`));
  });

  test("workspace feeds do not appear in the personal feeds dashboard", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    await createWorkspace(page, `E2E Sep Workspace ${Date.now()}`);
    await addFeedViaDiscovery(page);
    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible();

    // Switch back to the personal workspace; the workspace feed must not be listed.
    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: /personal/i }).click();
    await expect(page).toHaveURL(/\/feeds$/);
    await expect(page.getByRole("link", { name: /^Configure/ })).toHaveCount(0);
  });
});
