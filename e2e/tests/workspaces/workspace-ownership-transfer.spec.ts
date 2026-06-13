import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceWithMembershipsInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";

// Ownership transfer (a pure role swap; the workspace subscription is untouched).
// The authenticated test user is the owner of a seeded workspace with a verified
// co-admin. The view lives on the workspace settings page. Assertions go through
// the rendered UI only — never API.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

async function gotoMembers(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /account settings/i }).click();
  await expect(page.getByRole("heading", { name: "Your teams" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: `${workspaceName} settings` }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/settings$/, { timeout: 15000 });
}

test.describe("Workspace ownership transfer (owner view)", () => {
  test("owner hands ownership to a verified admin: roles swap and the old owner loses owner-only controls", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `owner-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const coAdminDiscordId = `successor-${discordUserId}`;
    const workspaceName = `Transfer WS ${discordUserId}`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
      otherMembers: [
        {
          role: "admin",
          discordUserId: coAdminDiscordId,
          // A valid transfer target must have a verified email.
          verifiedEmail: `successor-${discordUserId}@example.com`,
        },
      ],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const members = page.getByRole("region", { name: "Members" });
    await expect(members.getByRole("heading", { name: "Members" })).toBeVisible({
      timeout: 15000,
    });

    // The co-admin row carries the owner-only "Make owner" control.
    const adminRow = members.getByRole("listitem").filter({ hasText: /admin/i });
    await expect(adminRow).toHaveCount(1);
    await adminRow.getByRole("button", { name: /make .* the owner/i }).click();

    // The transfer is gated behind typing the team name (high-impact action).
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: /transfer ownership/i })).toBeVisible();
    await dialog.getByRole("textbox").fill(workspaceName);
    await dialog.getByRole("button", { name: /transfer ownership/i }).click();

    // Success is surfaced as a page alert.
    await expect(page.getByText(/ownership transferred/i)).toBeVisible({ timeout: 15000 });

    // The roles have swapped in the rendered list: the successor is now the owner,
    // and the test user (the "(you)" row) is now an admin.
    const successorRow = members
      .getByRole("listitem")
      .filter({ hasText: /owner/i })
      .filter({ hasNotText: /you/i });
    await expect(successorRow).toHaveCount(1, { timeout: 15000 });

    const selfRow = members.getByRole("listitem").filter({ hasText: /you/i });
    await expect(selfRow).toHaveCount(1);
    await expect(selfRow.getByText(/admin/i)).toBeVisible();

    // Having handed off ownership, the demoted user no longer sees any owner-only
    // member controls (Make owner / Remove). They can still leave.
    await expect(members.getByRole("button", { name: /make .* the owner/i })).toHaveCount(0);
    await expect(members.getByRole("button", { name: /^remove/i })).toHaveCount(0);
    await expect(members.getByRole("button", { name: /leave/i })).toBeVisible();
  });

  test("the transfer confirmation does not warn about billing when the team has no subscription", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `owner2-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `Transfer NoSub WS ${discordUserId}`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
      otherMembers: [
        {
          role: "admin",
          discordUserId: `successor2-${discordUserId}`,
          verifiedEmail: `successor2-${discordUserId}@example.com`,
        },
      ],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const members = page.getByRole("region", { name: "Members" });
    const adminRow = members.getByRole("listitem").filter({ hasText: /admin/i });
    await adminRow.getByRole("button", { name: /make .* the owner/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: /transfer ownership/i })).toBeVisible();
    // A workspace with no subscription has no card to bill, so the billing-tail
    // note must not appear.
    await expect(dialog.getByText(/keep billing your payment method/i)).toHaveCount(0);
  });
});
