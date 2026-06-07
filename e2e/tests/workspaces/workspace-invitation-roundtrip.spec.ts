import { test, expect, type Page, newInstrumentedContext } from "../../fixtures/test-fixtures";
import type { Browser } from "@playwright/test";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceWithMembershipsInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import {
  waitForInviteLink,
  waitForVerificationCode,
  resetCapturedMail,
} from "../../helpers/smtp";

// Full inviter -> invitee round-trip with NO direct invite seeding. The owner
// invites by email through the UI (the backend really dispatches the notification
// email); a second, logged-out user opens the link captured from that email,
// bootstraps via Discord OAuth, verifies the invited address via the real
// one-time-code flow, and accepts. The owner's member list then shows them as a
// member. Every assertion goes through the rendered UI; the only thing read out
// of band is the email the invitee would have received (via the mock mailer).

async function waitForAuthenticatedApp(page: Page, context = "app"): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Account settings" }),
    `${context}: authenticated shell never rendered (the "Account settings" button is ` +
      `absent, usually because the session/auth check failed)`,
  ).toBeVisible({ timeout: 20000 });
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

// A second, logged-out browser actor opens the invitation link from the email,
// bootstraps via Discord OAuth, enrols in the feature, verifies the invited
// email via the real one-time-code flow, accepts, and confirms they can see the
// workspace they joined in their own switcher.
// Opening the invite link logged-out kicks off a multi-redirect OAuth bootstrap:
// `RequireAuth` sees the 401, sets `window.location.href` to `/discord/login-v2`,
// which round-trips through the mock authorize and `callback-v2` (the backend
// validates an OAuth `state` it stored in the session cookie) before the app
// re-renders authenticated. That client-side redirect needs a beat to fire, so we
// must WAIT for the authenticated shell after each open rather than re-navigating
// in a tight loop (re-`goto`ing immediately stomps the redirect before it runs).
// On the rare run where the session is lost mid-chain we re-open the link, and if
// it never authenticates we fail with a legible message instead of a bare timeout.
async function bootstrapInviteeSession(page: Page, inviteLink: string): Promise<string> {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await page.goto(inviteLink);

    try {
      // Give the RequireAuth redirect + OAuth chain room to complete; on success
      // the authenticated shell renders and @me resolves.
      await waitForAuthenticatedApp(page, `invitee OAuth bootstrap (attempt ${attempt})`);
      const res = await page.request.get("/api/v1/discord-users/@me");

      if (res.status() === 200) {
        const { id } = (await res.json()) as { id: string };
        return id;
      }
    } catch {
      // Fall through to retry: a lost session mid-chain leaves the logged-out
      // shell, which never renders "Account settings".
    }
  }

  throw new Error(
    `Invitee OAuth bootstrap never authenticated after ${attempts} attempts: the logged-out ` +
      `OAuth redirect chain (login-v2 -> authorize -> callback-v2) failed to establish a session ` +
      `(/discord-users/@me kept returning 401). See attached browser-auth-error/http-401 annotations.`,
  );
}

async function inviteeAcceptsViaLink(
  browser: Browser,
  inviteLink: string,
  invitedEmail: string,
  workspaceName: string,
): Promise<void> {
  const context = await newInstrumentedContext(browser, test.info());
  const page = await context.newPage();

  try {
    // Open the invitation while logged out -> OAuth bootstrap (a brand-new user).
    // This retries the redirect chain and fails fast with a clear message if the
    // session never lands, instead of hanging on the authenticated-UI assertion.
    const discordUserId = await bootstrapInviteeSession(page, inviteLink);

    // The new user lacks the per-user workspaces flag, so the invite endpoints
    // 404 until it's enabled; enable it for the minted user and reload the link.
    await enableWorkspacesFeatureInDb(discordUserId);
    await page.goto(inviteLink);
    await waitForAuthenticatedApp(page, "invitee after enabling workspaces flag");

    // Verify the invited email through the real one-time-code flow.
    await expect(page.getByRole("button", { name: /send code/i })).toBeVisible({
      timeout: 20000,
    });
    await page.getByLabel(/email address/i).fill(invitedEmail);
    await page.getByRole("button", { name: /send code/i }).click();

    const code = await waitForVerificationCode(invitedEmail);
    await page.getByLabel(/verification code/i).fill(code);
    await page.getByRole("button", { name: /verify|confirm/i }).click();

    // Accept and gain the workspace.
    await page.getByRole("button", { name: /accept invitation/i }).click({
      timeout: 20000,
    });

    // Accepting drops the invitee straight into the workspace they just joined
    // (its scoped feeds view), rather than their personal feeds.
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 20000 });

    // The invitee themselves can now see they're part of the team: the workspace
    // they just joined is listed in their own switcher.
    const switcher = page.getByRole("button", { name: /Switch team/ });
    await expect(switcher).toBeVisible({ timeout: 20000 });
    await switcher.click();
    await expect(
      page.getByRole("menuitemradio", { name: workspaceName }),
    ).toBeVisible({ timeout: 20000 });
  } finally {
    await context.close();
  }
}

test.describe("Workspace invitations (inviter -> invitee round-trip)", () => {
  test("owner invites by email; the invitee receives it, accepts, and appears as a member", async ({
    page,
    browser,
  }) => {
    // Two real sessions (owner + invitee), a multi-redirect OAuth bootstrap, the
    // real one-time-code email verification, and accept — far more than the 30s
    // default budget. Give it room rather than racing the budget (the bootstrap's
    // 20s authenticated-shell wait alone can blow 30s and tear the context down).
    test.slow();

    // --- Session A: the owner sets up a workspace and invites by email. ---
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const ownerDiscordId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(ownerDiscordId);
    await setVerifiedEmailInDb(ownerDiscordId, `owner-${ownerDiscordId}@example.com`);
    const ownerUserId = await getUserMongoIdFromDiscordId(ownerDiscordId);

    const workspaceName = `Roundtrip WS ${ownerDiscordId}`;
    await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId: ownerUserId,
      selfRole: "owner",
    });

    // A fresh invitee address (no 6-digit run, so the captured code is never
    // confused with digits in the address).
    const invitedEmail = `invitee-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await resetCapturedMail();

    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    // Invite by email through the UI — this triggers the real notification send.
    await page.getByLabel("Invite by email").fill(invitedEmail);
    await page.getByRole("button", { name: "Send invite" }).click();

    // The pending invitation appears in the owner's rendered list.
    const pending = page.getByRole("region", { name: "Pending invitations" });
    await expect(pending.getByRole("listitem").filter({ hasText: invitedEmail })).toBeVisible({
      timeout: 20000,
    });

    // --- The invitee receives the email and acts on its link. ---
    const inviteLink = await waitForInviteLink(invitedEmail);
    await inviteeAcceptsViaLink(browser, inviteLink, invitedEmail, workspaceName);

    // --- Session A: the owner now sees the invitee as a member, and the pending
    // invitation is gone (it became a membership). ---
    await page.reload();
    await waitForAuthenticatedApp(page);
    await gotoMembers(page, workspaceName);

    const members = page.getByRole("region", { name: "Members" });
    await expect(members.getByRole("heading", { name: "Members" })).toBeVisible({
      timeout: 20000,
    });
    // Two members now: the owner and the freshly-accepted admin invitee.
    await expect(members.getByRole("listitem")).toHaveCount(2, { timeout: 20000 });
    await expect(
      page
        .getByRole("region", { name: "Pending invitations" })
        .getByRole("listitem")
        .filter({ hasText: invitedEmail }),
    ).toHaveCount(0);
  });
});
