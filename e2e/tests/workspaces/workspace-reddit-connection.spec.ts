import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";

// Workspace Reddit connections: workspace feeds resolve the WORKSPACE's Reddit
// connection (one member's grant backing the whole workspace), never anyone's
// personal connection. The reddit gate in workspace scope therefore prompts for a
// workspace connection, and the workspace settings page exposes the connection
// with attribution and any-member connect/disconnect.

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
  await page.getByRole("menuitem", { name: /create a team/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Team name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  const slug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(slug).toBeTruthy();
  return slug as string;
}

test.describe("Workspace Reddit connection", () => {
  test("pasting a subreddit URL in workspace scope shows the workspace connect gate", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);
    await createWorkspace(page, `E2E Reddit Workspace ${Date.now()}`);

    // 0 workspace feeds -> the discovery UI renders directly on the feeds page.
    await expect(
      page.getByRole("heading", { name: "Get news delivered to your Discord" }),
    ).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByRole("textbox", {
      name: "Search popular feeds or paste a URL",
    });
    await searchInput.fill("https://www.reddit.com/r/gaming/.rss");
    await page.getByRole("button", { name: "Go", exact: true }).click();

    // The gate prompts for a WORKSPACE connection ("a Reddit account", not "your"),
    // proving the workspace scope reached the validation endpoint and the CTA.
    await expect(page.getByText("Connect a Reddit account to continue")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByRole("button", { name: "Connect Reddit in popup window" }),
    ).toBeVisible();

    // Gate short-circuits before any fetch: no Add button appears.
    await expect(page.getByRole("button", { name: /^Add .+ feed$/i })).toHaveCount(0);
  });

  test("workspace settings exposes the Reddit connection as Not Connected with a connect action", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);
    const slug = await createWorkspace(page, `E2E Reddit Settings ${Date.now()}`);

    // Navigate to the workspace's settings page via Account Settings.
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();
    await page.getByRole("link", { name: /settings$/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/settings$`), {
      timeout: 15000,
    });

    // The integrations section shows the unconnected Reddit state with a connect
    // button (any member can connect on behalf of the workspace).
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByText("Not Connected")).toBeVisible();
    await expect(
      page.getByText(/One member connects their Reddit account on behalf of the whole workspace/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect Reddit in popup window" }),
    ).toBeVisible();
  });
});
