import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// Self-host posture: the mock stack runs WITHOUT Paddle configured, which is
// exactly the open-source/self-host configuration. Workspaces must be fully
// active with the default benefits and no billing UI may appear anywhere — no
// dormant banner, no activation empty state, no Billing settings entry, and no
// workspace-creation cap.

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

async function fillAndSubmitCreateTeamDialog(page: Page, workspaceName: string): Promise<void> {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Team name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
}

async function expectNoBillingUi(page: Page): Promise<void> {
  // Dormant banner and activation empty state must not exist.
  await expect(page.getByText("This team is not subscribed")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /Activate your team to start adding feeds/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /activate team/i })).toHaveCount(0);
}

test.describe("Workspace self-host posture (Paddle not configured)", () => {
  test("workspaces are fully active with no billing UI and no creation cap", async ({ page }) => {
    // One long journey (two workspace creations + a feed add), not one action.
    test.setTimeout(120_000);

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await enableWorkspacesForCurrentUser(page);

    // First workspace via the account menu (the entry point at 0 workspaces).
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /create a team/i }).click();
    await fillAndSubmitCreateTeamDialog(page, `E2E SelfHost Team ${Date.now()}`);

    // Fully active: the regular discovery UI renders, not an activation state.
    await expect(
      page.getByRole("heading", { name: "Get news delivered to your Discord" }),
    ).toBeVisible({ timeout: 15000 });
    await expectNoBillingUi(page);

    // A feed can be added immediately (default benefits, no dormancy gate).
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
    await expect(page.getByRole("link", { name: /^Configure/ })).toBeVisible();
    await expectNoBillingUi(page);

    // Team settings exists but exposes no Billing section/entry.
    await page.getByRole("link", { name: "Team settings" }).click();
    await expect(page.getByRole("heading", { name: "Team settings" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Billing" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /manage billing/i })).toHaveCount(0);

    // No creation cap without billing: a second never-activated workspace is
    // allowed (entry point moves to the team switcher once a team exists).
    await page.getByRole("button", { name: /Switch team/ }).click();
    await page.getByRole("menuitem", { name: /create team/i }).click();
    await fillAndSubmitCreateTeamDialog(page, `E2E SelfHost Team B ${Date.now()}`);
    await expectNoBillingUi(page);
  });
});
