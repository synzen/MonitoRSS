import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enablePremiumFeedsFeatureInDb,
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceWithMembershipsInDb,
} from "../../helpers/workspaces-db";

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

// Billing-enabled backend: the e2e-web project intentionally blanks Paddle so
// workspaces use the self-host operator cap instead of subscription benefits.
test.describe("Workspace legacy Tier 2 allowance", () => {
  test("clamps a stored add-on allowance to the current Tier 2 base", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await enablePremiumFeedsFeatureInDb(discordUserId);

    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);
    const workspaceName = `E2E Legacy Tier 2 ${Date.now()}`;
    const { slug } = await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
      withActiveSubscription: true,
      legacyTier2AddonQuantity: 30,
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: workspaceName }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`), {
      timeout: 15000,
    });
    await page.getByRole("button", { name: /^Gaming\./ }).click();

    const modal = page.getByRole("dialog");
    await expect(modal.getByRole("heading", { name: "Add a Feed" })).toBeVisible({
      timeout: 15000,
    });
    await expect(modal.getByText("Feed Limit: 0/70")).toBeVisible({
      timeout: 15000,
    });
    await expect(modal.getByText("Premium Feed Limit: 0/5")).toBeVisible();
  });
});
