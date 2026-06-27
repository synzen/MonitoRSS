import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceWithMembershipsInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import { resetCapturedMail, waitForInviteLink } from "../../helpers/smtp";

// Owner/admin member-management view (slice 6). The authenticated test user is a
// real member of a seeded workspace with co-members and pending invitations. The
// view is surfaced on the workspace settings page. Assertions go through the
// rendered UI only — never API.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

// Open the member-management view via Account Settings -> "Your teams" -> the
// workspace's Settings link (the same entry point exercised by workspaces.spec.ts),
// landing on the workspace settings page where the member-management view lives.
async function gotoMembers(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /account settings/i }).click();
  await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: `${workspaceName} settings` }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/settings$/, { timeout: 15000 });
}

test.describe("Workspace member management (owner/admin view)", () => {
  test("lists current members with their roles", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `owner-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `Members WS ${discordUserId}`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
      otherMembers: [{ role: "admin", discordUserId: `co-admin-${discordUserId}` }],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const members = page.getByRole("region", { name: "Members" });
    await expect(members.getByRole("heading", { name: "Members" })).toBeVisible({
      timeout: 15000,
    });

    // Two member rows: the owner (the test user) and the co-admin. Scope to the
    // named members list (the "Members" region also nests the pending invitations
    // list). Match each row by its exact role label rather than a loose substring:
    // an admin row also carries a "Make owner" transfer button, so /owner/i would
    // match it too.
    const memberList = members.getByRole("list", { name: "Workspace members" });
    await expect(memberList.getByRole("listitem")).toHaveCount(2);
    const ownerRow = memberList
      .getByRole("listitem")
      .filter({ has: page.getByText("owner", { exact: true }) });
    const adminRow = memberList
      .getByRole("listitem")
      .filter({ has: page.getByText("admin", { exact: true }) });
    await expect(ownerRow).toHaveCount(1);
    await expect(adminRow).toHaveCount(1);
  });

  test("lists outstanding pending invitations with inviter and creation time", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `owner-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `Invites WS ${discordUserId}`;
    const invitedEmail = `pending-${discordUserId}@example.com`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
      invitedEmails: [invitedEmail],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const pending = page.getByRole("region", { name: "Pending invitations" });
    await expect(pending.getByRole("heading", { name: "Pending invitations" })).toBeVisible({
      timeout: 15000,
    });

    const inviteRow = pending.getByRole("listitem").filter({ hasText: invitedEmail });
    await expect(inviteRow).toBeVisible();
    // Inviter (the test user invited it -> "you") and a relative creation time.
    await expect(inviteRow.getByText(/invited by you/i)).toBeVisible();
    await expect(inviteRow.getByText(/ago|just now/i)).toBeVisible();
  });

  test("owner revokes a pending invitation and it disappears from the list", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `owner-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `Revoke WS ${discordUserId}`;
    const invitedEmail = `revoke-me-${discordUserId}@example.com`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
      invitedEmails: [invitedEmail],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const pending = page.getByRole("region", { name: "Pending invitations" });
    const inviteRow = pending.getByRole("listitem").filter({ hasText: invitedEmail });
    await expect(inviteRow).toBeVisible({ timeout: 15000 });

    // Exact accessible name: the per-row aria-label folds in the email, so a loose
    // /revoke/i also matches the sibling Resend button when the address contains
    // that substring.
    await inviteRow
      .getByRole("button", { name: `Revoke invitation to ${invitedEmail}` })
      .click();
    // Confirm in the dialog.
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Revoke invitation" }).click();

    await expect(
      pending.getByRole("listitem").filter({ hasText: invitedEmail }),
    ).toHaveCount(0, { timeout: 15000 });
  });

  test("owner resends a pending invitation and a fresh email is dispatched", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `owner-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `Resend WS ${discordUserId}`;
    const invitedEmail = `pending-again-${discordUserId}@example.com`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
      invitedEmails: [invitedEmail],
      // Backdate past the per-invite resend cooldown so the resend dispatches now
      // instead of being rejected as too-soon after the seeded send.
      invitedLastSentAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    // No mail must be captured for this address before the resend, so the link we
    // observe afterwards is unambiguously the resent one.
    await resetCapturedMail(invitedEmail);

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const pending = page.getByRole("region", { name: "Pending invitations" });
    const inviteRow = pending.getByRole("listitem").filter({ hasText: invitedEmail });
    await expect(inviteRow).toBeVisible({ timeout: 15000 });

    // Exact accessible name: the per-row aria-label folds in the email, and a
    // loose /resend/i would also match the Revoke button when the address itself
    // contains that substring.
    await inviteRow
      .getByRole("button", { name: `Resend invitation to ${invitedEmail}` })
      .click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Resend invitation" }).click();

    // The success is surfaced in the rendered UI as a page alert, and the invite
    // stays in the pending list (a resend does not consume it).
    await expect(page.getByRole("alert").getByText(/invitation resent/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(pending.getByRole("listitem").filter({ hasText: invitedEmail })).toBeVisible();

    // The side-effect: the backend really dispatched a fresh invitation email to the
    // same address (read out of band via the mock mailer, the only non-UI check).
    const inviteLink = await waitForInviteLink(invitedEmail);
    expect(inviteLink).toMatch(/\/invites\/[^/]+$/);
  });

  test("owner removes a member and it disappears from the list", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `owner-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const coAdminDiscordId = `removable-${discordUserId}`;
    const workspaceName = `Remove WS ${discordUserId}`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
      otherMembers: [{ role: "admin", discordUserId: coAdminDiscordId }],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const members = page.getByRole("region", { name: "Members" });
    const memberList = members.getByRole("list", { name: "Workspace members" });
    // The other member's row carries a Remove control (owner-only).
    const otherRow = memberList.getByRole("listitem").filter({ hasText: /admin/i });
    await expect(otherRow).toBeVisible({ timeout: 15000 });

    await otherRow.getByRole("button", { name: /^remove/i }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: /remove/i }).click();

    await expect(memberList.getByRole("listitem").filter({ hasText: /admin/i })).toHaveCount(0, {
      timeout: 15000,
    });
  });

  test("an admin cannot remove other members (no remove control)", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `admin-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `AdminView WS ${discordUserId}`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      // The test user is an ADMIN; another member is the owner.
      selfRole: "admin",
      otherMembers: [{ role: "owner", discordUserId: `the-owner-${discordUserId}` }],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const members = page.getByRole("region", { name: "Members" });
    const ownerRow = members
      .getByRole("list", { name: "Workspace members" })
      .getByRole("listitem")
      .filter({ hasText: /owner/i });
    await expect(ownerRow).toBeVisible({ timeout: 15000 });

    // No remove-other control is rendered anywhere in the members list for an admin.
    await expect(members.getByRole("button", { name: /^remove/i })).toHaveCount(0);
    // The admin can still leave the workspace themselves.
    await expect(members.getByRole("button", { name: /leave/i })).toBeVisible();
  });

  test("a member can leave the workspace from the view", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `leaver-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `Leave WS ${discordUserId}`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      // Admin so leaving is allowed without tripping the last-owner invariant.
      selfRole: "admin",
      otherMembers: [{ role: "owner", discordUserId: `owner-of-${discordUserId}` }],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const members = page.getByRole("region", { name: "Members" });
    await expect(members.getByRole("heading", { name: "Members" })).toBeVisible({
      timeout: 15000,
    });

    await members.getByRole("button", { name: /leave/i }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: /leave/i }).click();

    // After leaving, the workspace is no longer in the switcher.
    await expect(page).toHaveURL(/\/feeds$/, { timeout: 15000 });
    await expect(page.getByRole("button", { name: `Switch workspace, current: ${workspaceName}` })).toHaveCount(
      0,
    );
  });

  test("the sole owner cannot leave: the last-owner error is shown and they remain a member", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `sole-owner-${discordUserId}@example.com`);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `SoleOwner WS ${discordUserId}`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      // Sole owner, no co-members: leaving would drop the last owner.
      selfRole: "owner",
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const members = page.getByRole("region", { name: "Members" });
    await expect(members.getByRole("heading", { name: "Members" })).toBeVisible({
      timeout: 15000,
    });

    await members.getByRole("button", { name: /leave/i }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: /leave/i }).click();

    // (a) The last-owner error is surfaced to the user in the dialog and the leave
    // is rejected — the dialog stays open showing the CANNOT_REMOVE_LAST_OWNER message.
    await expect(
      dialog.getByText(
        /A workspace must have at least one owner\. Transfer ownership before removing this member\./i,
      ),
    ).toBeVisible({ timeout: 15000 });

    // Dismiss the dialog and confirm (b) the user is still a member: their own
    // (owner) row still renders in the members list, and the workspace still
    // appears in the switcher.
    await dialog.getByRole("button", { name: /cancel/i }).click();
    const selfRow = members
      .getByRole("list", { name: "Workspace members" })
      .getByRole("listitem")
      .filter({ hasText: /owner/i })
      .filter({ hasText: /you/i });
    await expect(selfRow).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: `Switch workspace, current: ${workspaceName}` }),
    ).toBeVisible();
  });
});
