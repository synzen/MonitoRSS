import { test, expect, type Page, createAuthenticatedContext } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedMembershipInDb,
  seedWorkspaceWithMembershipsInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import { connectRedditViaPopup, uniqueSubreddit } from "../../helpers/reddit-oauth";

// Workspace Reddit connections: workspace feeds resolve the WORKSPACE's Reddit
// connection (one member's grant backing the whole workspace), never anyone's
// personal connection. The reddit gate in workspace scope therefore prompts for a
// workspace connection, and the workspace settings page exposes the connection
// with attribution and any-member connect/disconnect. The OAuth popup runs the
// real flow against the mock reddit server (authorize -> callback -> token
// exchange), and feed adds prove the stored grant authenticates fetches.

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

// Scope switches update the URL synchronously (history.pushState inside navigate()) but
// the React tree swaps on a later commit. Interacting with the discovery UI in between
// submits under the OLD scope — a workspace-credentialed validation rendered in personal
// scope (or vice versa). The switcher trigger's label is render-derived, so waiting for
// it guarantees the new scope has committed before the test types anything.
async function waitForCommittedScope(page: Page, scopeName: string | RegExp): Promise<void> {
  await expect(
    page.getByRole("button", {
      name:
        typeof scopeName === "string"
          ? `Switch team, current: ${scopeName}`
          : scopeName,
    }),
  ).toBeVisible({ timeout: 15000 });
}

async function switchToPersonalScope(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Switch team/ }).click();
  await page.getByRole("menuitemradio", { name: /personal/i }).click();
  await expect(page).toHaveURL(/\/feeds$/, { timeout: 15000 });
  await waitForCommittedScope(page, "Personal");
}

async function createWorkspace(page: Page, workspaceName: string): Promise<string> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /create a team/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Team name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  // The switcher may briefly label the fresh workspace "Team" until the workspaces
  // list refetches, so anchor on "any non-Personal scope" rather than the exact name.
  await waitForCommittedScope(page, /Switch team, current: (?!Personal$)/);
  const slug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(slug).toBeTruthy();
  return slug as string;
}

// In workspace scope, the switcher menu carries a direct "<name> settings" entry.
async function gotoWorkspaceSettingsViaSwitcher(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole("button", { name: /Switch team/ }).click();
  await page.getByRole("menuitem", { name: `${workspaceName} settings` }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/settings$/, { timeout: 15000 });
}

// Re-selecting the already-active workspace in the switcher's radio group may not fire a
// navigation, so hop through Personal and back to land on the workspace feeds page.
async function gotoWorkspaceFeedsViaSwitcher(page: Page, workspaceName: string): Promise<void> {
  await switchToPersonalScope(page);
  await page.getByRole("button", { name: /Switch team/ }).click();
  await page.getByRole("menuitemradio", { name: workspaceName }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  await waitForCommittedScope(page, workspaceName);
}

async function pasteUrlIntoInlineDiscovery(page: Page, url: string): Promise<void> {
  // 0 feeds in scope -> the discovery UI renders directly on the feeds page. The
  // heading differs by scope, so wait on the scope-agnostic search box instead.
  const searchInput = page.getByRole("textbox", {
    name: "Search popular feeds or paste a URL",
  });
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill(url);
  await page.getByRole("button", { name: "Go", exact: true }).click();
}

test.describe("Workspace Reddit connection", () => {
  test("connecting through the workspace gate adds the feed; personal scope stays gated", async ({
    page,
  }) => {
    test.slow();
    const workspaceFeed = uniqueSubreddit();
    const personalFeed = uniqueSubreddit();

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);
    await createWorkspace(page, `E2E Reddit Workspace ${Date.now()}`);

    await pasteUrlIntoInlineDiscovery(page, workspaceFeed.url);

    // The gate prompts for a WORKSPACE connection ("a Reddit account", not "your"),
    // proving the workspace scope reached the validation endpoint and the CTA.
    await expect(page.getByText("Connect a Reddit account to continue")).toBeVisible({
      timeout: 30000,
    });
    // Gate short-circuits before any fetch: no Add button appears.
    await expect(page.getByRole("button", { name: /^Add .+ feed$/i })).toHaveCount(0);

    await connectRedditViaPopup(
      page,
      page.getByRole("button", { name: "Connect Reddit in popup window" }),
    );

    // The popup's completion refreshes the workspace connection and auto-retries the
    // blocked validation: the feed card appears and the add goes through.
    const addButton = page.getByRole("button", { name: /^Add .+ feed$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 30000 });
    await addButton.click();
    await expect(page.getByText(/1 feed added/)).toBeVisible({ timeout: 10000 });

    // No fallback in reverse: the workspace's connection never unlocks PERSONAL feeds.
    await switchToPersonalScope(page);
    await pasteUrlIntoInlineDiscovery(page, personalFeed.url);
    await expect(page.getByText("Connect your Reddit account to continue")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole("button", { name: /^Add .+ feed$/i })).toHaveCount(0);
  });

  test("connect via settings unlocks feed adds; disconnect restores the gate", async ({
    page,
  }) => {
    test.slow();
    const firstFeed = uniqueSubreddit();
    const secondFeed = uniqueSubreddit();

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);
    const workspaceName = `E2E Reddit Settings ${Date.now()}`;
    await createWorkspace(page, workspaceName);

    await gotoWorkspaceSettingsViaSwitcher(page, workspaceName);

    // The integrations section shows the unconnected Reddit state with a connect
    // button (any member can connect on behalf of the workspace).
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByText("Not Connected")).toBeVisible();
    await expect(
      page.getByText(/One member connects their Reddit account on behalf of the whole workspace/),
    ).toBeVisible();

    await connectRedditViaPopup(
      page,
      page.getByRole("button", { name: "Connect Reddit in popup window" }),
    );

    // Connected, attributed to the member who connected it. (The members list also
    // renders "<name> (you)", so anchor to the attribution sentence.)
    await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Connected by .*\(you\)/)).toBeVisible();

    // With the workspace connected, a reddit feed adds with no gate at all.
    await gotoWorkspaceFeedsViaSwitcher(page, workspaceName);
    await pasteUrlIntoInlineDiscovery(page, firstFeed.url);
    const addButton = page.getByRole("button", { name: /^Add .+ feed$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Connect a Reddit account to continue")).toHaveCount(0);
    await addButton.click();
    await expect(page.getByText(/1 feed added/)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /View your feeds/ }).click();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    // exact-named link: the row also renders the URL link, which contains the title.
    await expect(
      page.getByRole("table").getByRole("link", { name: firstFeed.title, exact: true }),
    ).toBeVisible();

    // Any member can disconnect; the record is removed outright.
    await gotoWorkspaceSettingsViaSwitcher(page, workspaceName);
    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByText("Not Connected")).toBeVisible({ timeout: 15000 });

    // New reddit adds are gated again (via the Add a Feed dialog, since the
    // workspace now has a feed and the inline discovery no longer renders).
    await gotoWorkspaceFeedsViaSwitcher(page, workspaceName);
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Add Feed", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add a Feed" })).toBeVisible();
    await dialog
      .getByRole("textbox", { name: "Search popular feeds or paste a URL" })
      .fill(secondFeed.url);
    await dialog.getByRole("button", { name: "Go", exact: true }).click();
    await expect(dialog.getByText("Connect a Reddit account to continue")).toBeVisible({
      timeout: 30000,
    });
    await expect(dialog.getByRole("button", { name: /^Add .+ feed$/i })).toHaveCount(0);
  });

  test("a personal Reddit connection never unlocks workspace feeds (no fallback)", async ({
    page,
  }) => {
    test.slow();
    const personalFeed = uniqueSubreddit();
    const workspaceFeed = uniqueSubreddit();

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    // Establish a REAL personal connection first (popup completes, validation retries).
    await pasteUrlIntoInlineDiscovery(page, personalFeed.url);
    await expect(page.getByText("Connect your Reddit account to continue")).toBeVisible({
      timeout: 30000,
    });
    await connectRedditViaPopup(
      page,
      page.getByRole("button", { name: "Connect Reddit in popup window" }),
    );
    await expect(page.getByRole("button", { name: /^Add .+ feed$/i }).first()).toBeVisible({
      timeout: 30000,
    });

    // The workspace still demands its own connection.
    await createWorkspace(page, `E2E Reddit NoFallback ${Date.now()}`);
    await pasteUrlIntoInlineDiscovery(page, workspaceFeed.url);
    await expect(page.getByText("Connect a Reddit account to continue")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole("button", { name: /^Add .+ feed$/i })).toHaveCount(0);
  });

  test("removing the connecting member revokes the connection and another member reconnects", async ({
    page,
    browser,
  }) => {
    test.slow();

    // --- Owner session: a workspace the owner belongs to. ---
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    const ownerDiscordId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(ownerDiscordId);
    await setVerifiedEmailInDb(ownerDiscordId, `owner-${ownerDiscordId}@example.com`);
    const ownerUserId = await getUserMongoIdFromDiscordId(ownerDiscordId);

    const workspaceName = `Reddit Revoke WS ${ownerDiscordId}`;
    const { workspaceId } = await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId: ownerUserId,
      selfRole: "owner",
    });

    // --- Session B: a second REAL member connects the workspace's Reddit. ---
    const contextB = await createAuthenticatedContext(browser);
    try {
      const pageB = await contextB.newPage();
      await pageB.goto("/feeds");
      await waitForAuthenticatedApp(pageB);
      const memberDiscordId = await getDiscordUserIdFromPage(pageB);
      await enableWorkspacesFeatureInDb(memberDiscordId);
      const memberUserId = await getUserMongoIdFromDiscordId(memberDiscordId);
      await seedMembershipInDb({ workspaceId, userId: memberUserId, role: "admin" });
      await pageB.reload();
      await waitForAuthenticatedApp(pageB);

      await pageB.getByRole("button", { name: /Switch team/ }).click();
      await pageB.getByRole("menuitemradio", { name: workspaceName }).click();
      await expect(pageB).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
      await gotoWorkspaceSettingsViaSwitcher(pageB, workspaceName);

      await connectRedditViaPopup(
        pageB,
        pageB.getByRole("button", { name: "Connect Reddit in popup window" }),
      );
      await expect(pageB.getByText("Connected", { exact: true })).toBeVisible({
        timeout: 20000,
      });
      await expect(pageB.getByText(/Connected by .*\(you\)/)).toBeVisible();
    } finally {
      await contextB.close();
    }

    // --- The owner removes the connector; the exit revokes the grant. ---
    await page.reload();
    await waitForAuthenticatedApp(page);
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();
    await expect(page.getByRole("heading", { name: "Your teams" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("link", { name: `${workspaceName} settings` }).click();
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/settings$/, { timeout: 15000 });

    const members = page.getByRole("region", { name: "Members" });
    const memberRow = members.getByRole("listitem").filter({ hasText: /admin/i });
    await expect(memberRow).toBeVisible({ timeout: 15000 });
    await memberRow.getByRole("button", { name: /^remove/i }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /remove/i }).click();
    await expect(members.getByRole("listitem").filter({ hasText: /admin/i })).toHaveCount(0, {
      timeout: 15000,
    });

    // The connection died with the member's exit: the settings page shows the dead
    // state with guidance that any member can reconnect.
    await page.reload();
    await waitForAuthenticatedApp(page);
    await expect(page.getByText("Disconnected", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/no longer active/i)).toBeVisible();

    // The remaining member revives it with their OWN account.
    await connectRedditViaPopup(
      page,
      page.getByRole("button", { name: "Reconnect Reddit in popup window" }),
    );
    await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Connected by .*\(you\)/)).toBeVisible();
  });
});
