import { test, expect, type Page, createAuthenticatedContext } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedMembershipInDb,
  seedWorkspaceWithMembershipsInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import { connectReddit } from "../../helpers/reddit-oauth";

// Workspace Reddit connections: the workspace settings page exposes the
// connection with attribution and any-member connect/disconnect. The OAuth
// round trip runs same-tab flow against the mock reddit server (authorize ->
// callback -> token exchange). This spec covers the connection lifecycle
// itself: connect, disconnect, and revocation through membership changes.

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
          ? `Switch workspace, current: ${scopeName}`
          : scopeName,
    }),
  ).toBeVisible({ timeout: 15000 });
}

async function createWorkspace(page: Page, workspaceName: string): Promise<string> {
  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
  // The switcher may briefly label the fresh workspace "Team" until the workspaces
  // list refetches, so anchor on "any non-Personal scope" rather than the exact name.
  await waitForCommittedScope(page, /Switch workspace, current: (?!Personal$)/);
  const slug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1];
  expect(slug).toBeTruthy();
  return slug as string;
}

// In workspace scope, the switcher menu carries a direct "<name> settings" entry.
async function gotoWorkspaceSettingsViaSwitcher(page: Page, workspaceName: string): Promise<void> {
  // The workspaces list populates asynchronously and a refetch re-renders the
  // menu: it may open showing skeletons, or close mid-read. Retry opening until
  // the settings entry is actionable.
  await expect(async () => {
    if (
      (await page.getByRole("menuitem", { name: `${workspaceName} settings` }).count()) === 0
    ) {
      await page.getByRole("button", { name: /Switch workspace/ }).click();
    }

    await expect(
      page.getByRole("menuitem", { name: `${workspaceName} settings` }),
    ).toBeVisible({ timeout: 10000 });
  }).toPass({ timeout: 60000 });
  await page.getByRole("menuitem", { name: `${workspaceName} settings` }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/settings$/, { timeout: 15000 });
}

test.describe("Workspace Reddit connection", () => {
  test("connect via settings shows member attribution; disconnect removes the record", async ({
    page,
  }) => {
    test.slow();
    const workspaceName = `E2E Reddit Settings ${Date.now()}`;

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);
    await createWorkspace(page, workspaceName);

    await gotoWorkspaceSettingsViaSwitcher(page, workspaceName);

    // The integrations section shows the unconnected Reddit state with a connect
    // button (any member can connect on behalf of the workspace).
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByText("Not Connected")).toBeVisible();
    await expect(
      page.getByText(/One member connects their Reddit account on behalf of the whole workspace/),
    ).toBeVisible();

    await connectReddit(
      page,
      page.getByRole("button", { name: "Connect Reddit" }),
    );

    // Connected, attributed to the member who connected it. (The members list also
    // renders "<name> (you)", so anchor to the attribution sentence.)
    await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Connected by .*\(you\)/)).toBeVisible();

    // Any member can disconnect; the record is removed outright.
    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByText("Not Connected")).toBeVisible({ timeout: 15000 });
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

      await pageB.getByRole("button", { name: /Switch workspace/ }).click();
      await pageB.getByRole("menuitemradio", { name: workspaceName }).click();
      await expect(pageB).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
      await gotoWorkspaceSettingsViaSwitcher(pageB, workspaceName);

      await connectReddit(
        pageB,
        pageB.getByRole("button", { name: "Connect Reddit" }),
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
    await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible({
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
    await connectReddit(
      page,
      page.getByRole("button", { name: "Reconnect Reddit" }),
    );
    await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Connected by .*\(you\)/)).toBeVisible();
  });
});
