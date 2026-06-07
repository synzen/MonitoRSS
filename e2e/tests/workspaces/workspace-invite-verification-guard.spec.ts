import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  seedWorkspaceInviteInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import { peekVerificationCode, resetCapturedMail } from "../../helpers/smtp";

// Verifies the core guarantee of the invite-scoped verification send: when an
// invitee whose verified email does not match the invitation types an UNRELATED
// address into the verify step and attempts to send a code, the system must
// dispatch NO email to that unrelated address. The invite landing page only ever
// has the redacted hint, so it both guards the send client-side and routes
// through the invite-scoped endpoint, which the backend no-ops on a mismatch.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Workspace invite verification guard", () => {
  test("attempting to verify an unrelated email sends no code to that address", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    // The invitee's verified email differs from the invited address, so the
    // landing page renders the editable verify step (server withholds the full
    // invited address, returning only a redacted hint).
    await setVerifiedEmailInDb(discordUserId, `someone-else-${discordUserId}@example.com`);

    const invitedEmail = `invited-${discordUserId}@example.com`;
    const workspaceName = `Guard Workspace ${discordUserId}`;
    const { inviteId } = await seedWorkspaceInviteInDb({
      workspaceName,
      email: invitedEmail,
    });

    await resetCapturedMail();
    await page.goto(`/invites/${inviteId}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(workspaceName) }),
    ).toBeVisible({ timeout: 15000 });

    // Type a clearly-unrelated address and attempt to send the code.
    const unrelatedEmail = `attacker-${discordUserId}@evil.example.net`;
    await page.getByLabel(/email address/i).fill(unrelatedEmail);
    await page.getByRole("button", { name: /send code/i }).click();

    // The UI surfaces the guard, steering the user to the invited address rather
    // than the one they typed.
    await expect(
      page.getByText(/enter the address this invitation was sent to/i),
    ).toBeVisible({ timeout: 15000 });

    // The decisive assertion: the mock mailer captured NO verification code for
    // the unrelated address. (peek returns null instead of throwing on absence.)
    const code = await peekVerificationCode(unrelatedEmail);
    expect(code).toBeNull();
  });
});
