import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  seedWorkspaceInviteInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";

// Invitee-side flow (slice 5): an invitation is addressed to an email. The
// authenticated test user is the invitee; the workspace + invite are seeded
// directly so the user is a pure invitee (never the owner). Assertions go
// through the rendered UI only — the switcher/list/landing page — never API.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Workspace invitations (invitee side)", () => {
  // The matching-email accept-and-gain-workspace path is covered end to end (with
  // a real invite send + OTP) by workspace-invitation-roundtrip.spec.ts and
  // workspace-invitation-anonymous.spec.ts, so it is not duplicated here.

  test("invitee whose verified email does not match is guided to verify the invited address", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    // The user has a DIFFERENT verified email than the one the invite is for.
    await setVerifiedEmailInDb(discordUserId, `someone-else-${discordUserId}@example.com`);

    const invitedEmail = `invited-${discordUserId}@example.com`;
    const workspaceName = `Mismatch Workspace ${discordUserId}`;
    const { inviteId } = await seedWorkspaceInviteInDb({
      workspaceName,
      email: invitedEmail,
    });

    await page.goto(`/invites/${inviteId}`);

    await expect(
      page.getByRole("heading", { name: new RegExp(workspaceName) }),
    ).toBeVisible({ timeout: 15000 });

    // The page guides the mismatched user to verify and offers to send a code.
    await expect(page.getByRole("button", { name: /send code/i })).toBeVisible();
    // The full invited address is NOT disclosed to a non-matching caller (the
    // server returns only a redacted hint); only the verified-match invitee sees
    // it. So the mismatch page must NOT render the full invited email.
    await expect(page.getByText(invitedEmail)).toHaveCount(0);
    // No accept action until the invited email is verified.
    await expect(page.getByRole("button", { name: /accept invitation/i })).toHaveCount(0);
  });

  test("invitee with multiple invitations sees them all and acts on each independently", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    const email = `multi-${discordUserId}@example.com`;
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, email);

    const workspaceA = `Multi A ${discordUserId}`;
    const workspaceB = `Multi B ${discordUserId}`;
    await seedWorkspaceInviteInDb({ workspaceName: workspaceA, email });
    await seedWorkspaceInviteInDb({ workspaceName: workspaceB, email });

    // The pending invitations surface lives in Account Settings.
    await page.reload();
    await waitForAuthenticatedApp(page);
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /account settings/i }).click();

    const pending = page.getByRole("region", { name: "Pending invitations" });
    await expect(pending.getByRole("heading", { name: "Pending invitations" })).toBeVisible({
      timeout: 15000,
    });

    // Both invitations are listed in the pending region, each in its own item.
    const inviteA = pending.getByRole("listitem").filter({ hasText: workspaceA });
    const inviteB = pending.getByRole("listitem").filter({ hasText: workspaceB });
    await expect(inviteA).toBeVisible();
    await expect(inviteB).toBeVisible();

    // Decline B independently — only B leaves the pending list; A stays actionable.
    await inviteB.getByRole("button", { name: "Decline" }).click();
    await expect(pending.getByRole("listitem").filter({ hasText: workspaceB })).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(pending.getByRole("listitem").filter({ hasText: workspaceA })).toBeVisible();

    // Accept A — it leaves the pending list and becomes a workspace in the switcher.
    await inviteA.getByRole("button", { name: "Accept" }).click();
    await expect(pending.getByRole("listitem").filter({ hasText: workspaceA })).toHaveCount(0, {
      timeout: 15000,
    });

    const switcher = page.getByRole("button", { name: /Switch team/ });
    await expect(switcher).toBeVisible({ timeout: 15000 });
    await switcher.click();
    await expect(page.getByRole("menuitemradio", { name: workspaceA })).toBeVisible();
  });
});
