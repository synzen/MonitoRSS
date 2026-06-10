import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { WorkspacesService } from "../../src/features/workspaces/workspaces.service";
import { EmailVerificationService } from "../../src/features/users/email-verification.service";
import type { SmtpTransport } from "../../src/infra/smtp";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface ErrorResult {
  code: string;
}

interface InviteResult {
  result: {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    invitedByUserId: string;
  };
}

interface InviteListResult {
  result: Array<{ id: string; email: string }>;
}

describe("Workspace invite controls API", () => {
  let ctx: AppTestContext;
  let sent: Array<{ to: string; html: string }>;

  before(async () => {
    ctx = await createAppTestContext({
      configOverrides: { BACKEND_API_SMTP_FROM_DOMAIN: "example.com" },
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  // Swap in a capturing mailer so invite sends can be exercised without an SMTP
  // server (the harness leaves SMTP unconfigured).
  beforeEach(() => {
    sent = [];
    const fakeTransport = {
      sendMail: async (msg: { to: string; html: string }) => {
        sent.push({ to: msg.to, html: String(msg.html) });
        return {};
      },
    } as unknown as SmtpTransport;

    ctx.container.workspacesService = new WorkspacesService({
      config: ctx.container.config,
      smtpTransport: fakeTransport,
      workspaceRepository: ctx.container.workspaceRepository,
      userRepository: ctx.container.userRepository,
      userFeedRepository: ctx.container.userFeedRepository,
      emailVerificationService: new EmailVerificationService({
        config: ctx.container.config,
        smtpTransport: fakeTransport,
        emailVerificationRepository: ctx.container.emailVerificationRepository,
        userRepository: ctx.container.userRepository,
      }),
      redditApiService: ctx.container.redditApiService,
    });
  });

  async function seedUser(): Promise<{
    discordUserId: string;
    internalId: string;
  }> {
    const discordUserId = randomUUID();
    await ctx.container.userRepository.create({
      discordUserId,
      email: `${discordUserId}@example.com`,
    });

    await ctx.connection
      .collection("users")
      .updateOne(
        { discordUserId },
        { $set: { "featureFlags.workspaces": true } },
      );

    const internalId =
      await ctx.container.userRepository.findIdByDiscordId(discordUserId);
    return { discordUserId, internalId: internalId as string };
  }

  async function seedWorkspace(
    ownerUserId: string,
  ): Promise<{ id: string; slug: string }> {
    const slug = `ws-${randomUUID().slice(0, 8)}`;
    const workspace =
      await ctx.container.workspaceRepository.createWorkspaceWithOwner({
        name: "Test Workspace",
        slug,
        ownerUserId,
      });
    return { id: workspace.id, slug: workspace.slug };
  }

  async function createInvite(
    slug: string,
    discordUserId: string,
    email: string,
  ): Promise<string> {
    const authed = await ctx.asUser(discordUserId);
    const res = await authed.fetch(`/api/v1/workspaces/${slug}/invites`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    assert.strictEqual(res.status, 201);
    return (await readJson<InviteResult>(res)).result.id;
  }

  // Pushes an invite's last-sent timestamp into the past so a resend is not
  // rejected by the cooldown, without waiting in real time.
  async function expireResendCooldown(inviteId: string): Promise<void> {
    await ctx.connection
      .collection("workspaceinvites")
      .updateOne(
        { _id: new Types.ObjectId(inviteId) },
        { $set: { lastSentAt: new Date(0) } },
      );
  }

  it("lets an owner resend a pending invite, re-sending the notification email", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const email = `${randomUUID()}@example.com`;
    const inviteId = await createInvite(
      workspace.slug,
      owner.discordUserId,
      email,
    );

    sent = [];
    await expireResendCooldown(inviteId);

    const authed = await ctx.asUser(owner.discordUserId);
    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}/resend`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 200);

    assert.strictEqual(sent.length, 1);
    const mail = sent[0];
    assert.ok(mail);
    assert.strictEqual(mail.to, email);
    assert.ok(
      mail.html.includes(`/invites/${inviteId}`),
      "resent email must link to the invite id",
    );
  });

  it("rejects a resend within the cooldown window with 429", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const email = `${randomUUID()}@example.com`;
    const inviteId = await createInvite(
      workspace.slug,
      owner.discordUserId,
      email,
    );

    // No cooldown reset: the create just set lastSentAt to now.
    sent = [];
    const authed = await ctx.asUser(owner.discordUserId);
    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}/resend`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 429);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INVITE_RESEND_TOO_SOON",
    );
    assert.strictEqual(sent.length, 0);
  });

  it("lets an owner revoke a pending invite, removing it from the pending list", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const email = `${randomUUID()}@example.com`;
    const inviteId = await createInvite(
      workspace.slug,
      owner.discordUserId,
      email,
    );

    const authed = await ctx.asUser(owner.discordUserId);
    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    assert.strictEqual(res.status, 200);

    const listRes = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
    );
    const list = await readJson<InviteListResult>(listRes);
    assert.strictEqual(
      list.result.find((i) => i.id === inviteId),
      undefined,
      "revoked invite must not appear in the pending list",
    );
    assert.strictEqual(list.result.length, 0);
  });

  it("rejects creating an invite once the workspace is at its pending-invite cap", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    // Seed the workspace up to the cap with raw pending-invite rows.
    const CAP = 25;
    const rows = Array.from({ length: CAP }, () => ({
      workspaceId: new Types.ObjectId(workspace.id),
      email: `${randomUUID()}@example.com`,
      role: "admin",
      invitedByUserId: new Types.ObjectId(owner.internalId),
      lastSentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await ctx.connection.collection("workspaceinvites").insertMany(rows);

    const authed = await ctx.asUser(owner.discordUserId);
    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      {
        method: "POST",
        body: JSON.stringify({ email: `${randomUUID()}@example.com` }),
      },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INVITE_LIMIT_REACHED",
    );
    // The over-cap creation must not have sent a notification email.
    assert.strictEqual(sent.length, 0);
  });

  it("returns 404 WORKSPACE_NOT_FOUND for a non-member trying to resend or revoke", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const inviteId = await createInvite(
      workspace.slug,
      owner.discordUserId,
      `${randomUUID()}@example.com`,
    );

    const outsider = await seedUser();
    const authed = await ctx.asUser(outsider.discordUserId);

    // A non-member cannot tell the workspace (or invite) exists: both surface as
    // 404 WORKSPACE_NOT_FOUND, matching create/list behavior.
    const resendRes = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}/resend`,
      { method: "POST" },
    );
    assert.strictEqual(resendRes.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(resendRes)).code,
      "WORKSPACE_NOT_FOUND",
    );

    const revokeRes = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    assert.strictEqual(revokeRes.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(revokeRes)).code,
      "WORKSPACE_NOT_FOUND",
    );

    // The invite still exists: the non-member's revoke did nothing.
    const count = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({ _id: new Types.ObjectId(inviteId) });
    assert.strictEqual(count, 1);
  });

  it("returns 404 WORKSPACE_INVITE_NOT_FOUND when an owner resends an invite that no longer exists", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const inviteId = await createInvite(
      workspace.slug,
      owner.discordUserId,
      `${randomUUID()}@example.com`,
    );

    const authed = await ctx.asUser(owner.discordUserId);

    // Revoke it first so the subsequent resend targets a gone invite.
    const revokeRes = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    assert.strictEqual(revokeRes.status, 200);

    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}/resend`,
      { method: "POST" },
    );
    // The owner IS a member, so this is not a workspace-scope 404 — it is the
    // invite-specific not-found code (pins the review #2 error-code fix).
    assert.strictEqual(res.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INVITE_NOT_FOUND",
    );
  });

  it("returns 404 WORKSPACE_INVITE_NOT_FOUND when an owner revokes an invite that is already gone", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const inviteId = await createInvite(
      workspace.slug,
      owner.discordUserId,
      `${randomUUID()}@example.com`,
    );

    const authed = await ctx.asUser(owner.discordUserId);

    const firstRevoke = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    assert.strictEqual(firstRevoke.status, 200);

    // Revoking the same (now-gone) invite reports it as not found rather than
    // succeeding again or 500ing.
    const secondRevoke = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    assert.strictEqual(secondRevoke.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(secondRevoke)).code,
      "WORKSPACE_INVITE_NOT_FOUND",
    );
  });
});
