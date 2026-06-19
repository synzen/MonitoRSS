import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// Workspace navigation: the "/" landing restores the last-active scope, the logo is
// scope-relative, workspace feeds pages expose settings on-page, and breadcrumb roots
// carry the scope name.

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

async function createWorkspace(page: Page, workspaceName: string): Promise<string> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  const slug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(slug).toBeTruthy();
  return slug as string;
}

async function addFeedViaDiscovery(page: Page): Promise<void> {
  // The discovery heading differs by scope ("...to your Discord" personal,
  // "Add feeds for your team" in a workspace); the search box is scope-agnostic,
  // so use it as the discovery-ready signal.
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

// The last-active scope is recorded with a fire-and-forget PATCH; start listening
// BEFORE the scope change that triggers it so a later "/" visit deterministically
// sees the recorded value.
function waitForScopeRecording(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().includes("/api/v1/users/@me"),
    { timeout: 15000 },
  );
}

test.describe("Workspace navigation", () => {
  test("the '/' landing restores the last-active scope", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    const workspaceName = `E2E Nav Workspace ${Date.now()}`;
    const workspaceRecorded = waitForScopeRecording(page);
    const slug = await createWorkspace(page, workspaceName);
    await workspaceRecorded;

    // Visiting "/" lands back in the workspace, verified through the rendered scope chip.
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`), { timeout: 15000 });
    await expect(
      page.getByRole("button", { name: `Switch workspace, current: ${workspaceName}` }),
    ).toBeVisible();

    // Switching to personal updates the recorded scope; "/" now lands on personal feeds.
    const personalRecorded = waitForScopeRecording(page);
    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: /personal/i }).click();
    await expect(
      page.getByRole("button", { name: "Switch workspace, current: Personal" }),
    ).toBeVisible();
    await personalRecorded;

    await page.goto("/");
    await expect(page).toHaveURL(/\/feeds$/, { timeout: 15000 });
    expect(page.url()).not.toContain("/workspaces/");
    await expect(
      page.getByRole("button", { name: "Switch workspace, current: Personal" }),
    ).toBeVisible();
  });

  test("workspace feeds page shows the team heading with an on-page settings link, and the logo stays in scope", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    const workspaceName = `E2E Nav Settings ${Date.now()}`;
    const slug = await createWorkspace(page, workspaceName);

    await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

    // The logo is scope-relative: "home" inside a workspace is the workspace's feeds.
    await page.getByRole("link", { name: "MonitoRSS Home" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`));

    // Settings is one visible on-page click — no switcher menu required.
    await page.getByRole("link", { name: "Workspace settings" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/settings$`), { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
  });

  test("switching scopes moves focus to the new page's heading", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    // A personal feed keeps personal scope out of discovery mode, so it renders
    // the "Feeds" h1 the announcer moves focus to.
    await addFeedViaDiscovery(page);

    const workspaceName = `E2E Nav Focus ${Date.now()}`;
    await createWorkspace(page, workspaceName);

    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: /personal/i }).click();
    await expect(
      page.getByRole("button", { name: "Switch workspace, current: Personal" }),
    ).toBeVisible();

    // The navigation announcer moves focus to the new page's h1 (after its 500ms delay).
    await expect(page.getByRole("heading", { name: /^Feeds/, level: 1 })).toBeFocused({
      timeout: 5000,
    });

    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: workspaceName }).click();
    await expect(
      page.getByRole("button", { name: `Switch workspace, current: ${workspaceName}` }),
    ).toBeVisible();

    // In workspace scope the h1 is the workspace name, so focusing it announces the new scope.
    await expect(page.getByRole("heading", { name: workspaceName, level: 1 })).toBeFocused({
      timeout: 5000,
    });
  });

  test("breadcrumb roots carry the scope name in both scopes", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    const workspaceName = `E2E Nav Crumbs ${Date.now()}`;
    const slug = await createWorkspace(page, workspaceName);

    await addFeedViaDiscovery(page);
    await page.getByRole("link", { name: /^Configure/ }).click();

    // The feed detail breadcrumb roots at the workspace and links back to its feeds.
    const workspaceCrumb = page.getByRole("link", { name: workspaceName });
    await expect(workspaceCrumb).toBeVisible({ timeout: 15000 });
    await workspaceCrumb.click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`));

    // In personal scope the same crumb says "Personal" once the user has a workspace.
    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: /personal/i }).click();
    await expect(
      page.getByRole("button", { name: "Switch workspace, current: Personal" }),
    ).toBeVisible();

    await addFeedViaDiscovery(page);
    await page.getByRole("link", { name: /^Configure/ }).click();

    const personalCrumb = page.getByRole("link", { name: "Personal" });
    await expect(personalCrumb).toBeVisible({ timeout: 15000 });
    await personalCrumb.click();
    await expect(page).toHaveURL(/\/feeds$/);
    expect(page.url()).not.toContain("/workspaces/");
  });
});
