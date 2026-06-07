import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb } from "../../helpers/workspaces-db";
import { waitForInviteLink, waitForVerificationCode, resetCapturedMail } from "../../helpers/smtp";

// End-to-end coverage of the self-accept dead-end. An owner (already a member of
// their own workspace) opens an invitation they sent to a DIFFERENT address. The
// landing page must recognise they are already a member and short-circuit BEFORE
// the verify step — so it never pushes them through email verification, which
// would overwrite their verified email for an accept the server rejects anyway.
//
// The decisive assertions, all read from the rendered UI:
//   1) The invite page shows an "already a member" message, with NO verify step
//      and NO accept button.
//   2) The invitation stays pending (it was never consumed).
//   3) The owner's verified email is untouched — proven by re-opening the create
//      team dialog and landing directly on the name field (it skips the verify
//      step only when a verified email is still set).
//
// The single feature-flag enable is a rollout gate every workspaces spec sets, not
// fixture data for this scenario.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 20000,
  });
}

async function gotoMembers(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /account settings/i }).click();
  await expect(page.getByRole("heading", { name: "Your teams" })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("link", { name: `${workspaceName} settings` }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/settings$/, { timeout: 20000 });
}

test.describe("Workspace invite self-accept guard", () => {
  test("an existing member opening their own invite is told they're already a member, with no verify step, and their verified email is untouched", async ({
    page,
  }) => {
    // Create workspace + invite + open the invite + re-verify the verified email
    // is intact is a long multi-navigation flow; give it room beyond the 30s
    // default rather than racing the budget.
    test.slow();

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const ownerDiscordId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(ownerDiscordId);
    await page.reload();
    await waitForAuthenticatedApp(page);

    // Two addresses. The owner verifies `ownerEmail` to create the workspace, then
    // invites a DIFFERENT address `invitedEmail`. Inviting an address you ALREADY
    // own is blocked at creation, so the scenario needs a distinct invited address.
    // Fresh addresses with no 6-digit run, so a captured code is never confused
    // with digits in the address.
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const ownerEmail = `owner-${suffix}@example.com`;
    const invitedEmail = `invited-${suffix}@example.com`;
    await resetCapturedMail();

    // --- Create a workspace through the UI, verifying ownerEmail via real OTP. ---
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /create a team/i }).click();

    const dialog = page.getByRole("dialog");
    // Workspace creation is gated behind a verified email, so the dialog opens on
    // the verify step.
    await dialog.getByLabel(/email address/i).fill(ownerEmail);
    await dialog.getByRole("button", { name: /send code/i }).click();

    const createCode = await waitForVerificationCode(ownerEmail);
    await dialog.getByLabel(/verification code/i).fill(createCode);
    await dialog.getByRole("button", { name: /verify|confirm/i }).click();

    const workspaceName = `Self Accept WS ${ownerDiscordId}`;
    await dialog.getByLabel("Team name").fill(workspaceName);
    await dialog.getByRole("button", { name: "Create team" }).click();

    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 20000 });

    // --- Invite a DIFFERENT address through the UI — a real notification send.
    // The owner does not own this address, so creation succeeds. ---
    await resetCapturedMail();
    await gotoMembers(page, workspaceName);
    await page.getByLabel("Invite by email").fill(invitedEmail);
    await page.getByRole("button", { name: "Send invite" }).click();

    const pending = page.getByRole("region", { name: "Pending invitations" });
    await expect(pending.getByRole("listitem").filter({ hasText: invitedEmail })).toBeVisible({
      timeout: 20000,
    });

    // --- Open the invitation from its real email link. The owner is already a
    // member, so the page must short-circuit to the "already a member" state
    // WITHOUT ever offering the verify step. ---
    const inviteLink = await waitForInviteLink(invitedEmail);
    await page.goto(inviteLink);
    await expect(
      page.getByRole("heading", { name: new RegExp(workspaceName) }),
    ).toBeVisible({ timeout: 20000 });

    // The "already a member" message is shown...
    await expect(page.getByText(/you're already a member/i)).toBeVisible({ timeout: 20000 });
    // ...and crucially, the verify step is NOT offered (no email field, no send-code
    // button), so the owner's verified email is never overwritten.
    await expect(page.getByRole("button", { name: /send code/i })).toHaveCount(0);
    await expect(page.getByLabel(/email address/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /accept invitation/i })).toHaveCount(0);

    // --- State assertions, all read from the rendered UI. ---
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    // 1) The invitation is still pending — it was NOT consumed, so the intended
    // person can still claim it on a different account.
    await gotoMembers(page, workspaceName);
    await expect(
      page
        .getByRole("region", { name: "Pending invitations" })
        .getByRole("listitem")
        .filter({ hasText: invitedEmail }),
    ).toHaveCount(1, { timeout: 20000 });

    // 2) The member list still shows exactly one member (no phantom second member).
    const members = page.getByRole("region", { name: "Members" });
    await expect(members.getByRole("heading", { name: "Members" })).toBeVisible({
      timeout: 20000,
    });
    await expect(members.getByRole("listitem")).toHaveCount(1, { timeout: 20000 });

    // 3) The owner's verified email is untouched: re-opening the create team dialog
    // lands directly on the name field (it skips the verify step only when a
    // verified email is still set). Had the invite flow overwritten the verified
    // email, this would instead show the verify step.
    //
    // Once the user has a workspace, "Create team" lives in the workspace switcher
    // (the account-menu entry only appears at zero workspaces), so open it there.
    await page.getByRole("button", { name: /switch team, current:/i }).click();
    await page.getByRole("menuitem", { name: /create team/i }).click();
    const dialog2 = page.getByRole("dialog");
    await expect(dialog2.getByLabel("Team name")).toBeVisible({ timeout: 20000 });
    await expect(dialog2.getByRole("button", { name: /send code/i })).toHaveCount(0);
  });
});
