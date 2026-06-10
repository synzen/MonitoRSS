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
  result: Array<{
    id: string;
    email: string;
    role: string;
    createdAt: string;
    invitedByUserId: string;
  }>;
}

describe("Workspace invites API", () => {
  let ctx: AppTestContext;
  let sent: Array<{ to: string; html: string }>;

  before(async () => {
    // A from-domain is required for the sender address (createFromFormatter);
    // the fake transport below stands in for an actual SMTP server.
    ctx = await createAppTestContext({
      configOverrides: { BACKEND_API_SMTP_FROM_DOMAIN: "example.com" },
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  // Swap in a capturing mailer so invite creation can be exercised without an
  // SMTP server (the harness leaves SMTP unconfigured). Individual tests can
  // override this with a throwing/absent transport to simulate SMTP-down.
  beforeEach(() => {
    sent = [];
    const fakeTransport = {
      sendMail: async (msg: { to: string; html: string }) => {
        sent.push({ to: msg.to, html: String(msg.html) });
        return {};
      },
    } as unknown as SmtpTransport;

    // The invite-scoped verification send delegates to EmailVerificationService;
    // wire a real one (same capturing transport) so those sends are observable.
    const emailVerificationService = new EmailVerificationService({
      config: ctx.container.config,
      smtpTransport: fakeTransport,
      emailVerificationRepository: ctx.container.emailVerificationRepository,
      userRepository: ctx.container.userRepository,
    });
    ctx.container.emailVerificationService = emailVerificationService;

    ctx.container.workspacesService = new WorkspacesService({
      config: ctx.container.config,
      smtpTransport: fakeTransport,
      workspaceRepository: ctx.container.workspaceRepository,
      userRepository: ctx.container.userRepository,
      userFeedRepository: ctx.container.userFeedRepository,
      emailVerificationService,
      redditApiService: ctx.container.redditApiService,
    });
  });

  // Seeds a user with the workspaces feature flag and (optionally) a verified
  // email, returning the internal user id.
  async function seedUser(
    opts: { verifiedEmail?: string } = {},
  ): Promise<{ discordUserId: string; internalId: string }> {
    const discordUserId = randomUUID();
    await ctx.container.userRepository.create({
      discordUserId,
      email: `${discordUserId}@example.com`,
    });

    const set: Record<string, unknown> = {
      "featureFlags.workspaces": true,
    };
    if (opts.verifiedEmail) {
      set.verifiedEmail = opts.verifiedEmail;
      set.verifiedEmailVerifiedAt = new Date();
    }

    await ctx.connection
      .collection("users")
      .updateOne({ discordUserId }, { $set: set });

    const internalId =
      await ctx.container.userRepository.findIdByDiscordId(discordUserId);
    return { discordUserId, internalId: internalId as string };
  }

  // Creates a workspace owned by the given user and returns its slug + id.
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

  it("lets an owner create an invite and sends a notification email", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const authed = await ctx.asUser(owner.discordUserId);

    const inviteEmail = `Invitee+Tag@Example.com`;
    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: inviteEmail }) },
    );
    assert.strictEqual(res.status, 201);

    const body = await readJson<InviteResult>(res);
    assert.strictEqual(body.result.email, "invitee+tag@example.com");
    assert.strictEqual(body.result.role, "admin");
    assert.strictEqual(body.result.invitedByUserId, owner.internalId);
    assert.ok(body.result.id);

    // The notification email was sent to the normalized address.
    assert.strictEqual(sent.length, 1);
    const email = sent[0];
    assert.ok(email);
    assert.strictEqual(email.to, "invitee+tag@example.com");
    // The link is keyed by invite id, never the email address.
    assert.ok(
      email.html.includes(`/invites/${body.result.id}`),
      "email must link to the invite id",
    );
    assert.ok(
      !email.html.includes("invitee+tag@example.com"),
      "email must not contain the invited address in the link",
    );

    // The row is persisted with the normalized email + role + inviter.
    const row = await ctx.connection
      .collection("workspaceinvites")
      .findOne({ _id: new Types.ObjectId(body.result.id) });
    assert.ok(row);
    assert.strictEqual(row.email, "invitee+tag@example.com");
    assert.strictEqual(row.role, "admin");
    assert.strictEqual(row.workspaceId.toString(), workspace.id);
    assert.strictEqual(row.invitedByUserId.toString(), owner.internalId);
  });

  it("rejects creating an invite with a malformed email with 400", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const authed = await ctx.asUser(owner.discordUserId);

    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: "not-an-email" }) },
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(sent.length, 0);
  });

  it("lets a non-owner admin member create and list invites", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const admin = await seedUser();
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(workspace.id),
      userId: new Types.ObjectId(admin.internalId),
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const authed = await ctx.asUser(admin.discordUserId);

    const inviteEmail = `${randomUUID()}@example.com`;
    const createRes = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: inviteEmail }) },
    );
    assert.strictEqual(createRes.status, 201);
    const created = await readJson<InviteResult>(createRes);
    assert.strictEqual(created.result.invitedByUserId, admin.internalId);

    const listRes = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
    );
    assert.strictEqual(listRes.status, 200);
    const list = await readJson<InviteListResult>(listRes);
    assert.strictEqual(list.result.length, 1);
    assert.strictEqual(list.result[0]?.email, inviteEmail);
    assert.strictEqual(list.result[0]?.invitedByUserId, admin.internalId);
    assert.ok(list.result[0]?.createdAt);
  });

  it("rejects inviting an email that already belongs to a member of this workspace, scoped per-workspace", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const authed = await ctx.asUser(owner.discordUserId);

    // A user verified under the target email who is already a member here.
    const memberEmail = `${randomUUID()}@example.com`;
    const member = await seedUser({ verifiedEmail: memberEmail });
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(workspace.id),
      userId: new Types.ObjectId(member.internalId),
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: memberEmail }) },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_MEMBER_ALREADY_EXISTS",
    );
    assert.strictEqual(sent.length, 0);

    // The same email CAN be invited to a DIFFERENT workspace where they are not
    // a member: the member check is per-workspace, not global.
    const otherOwner = await seedUser();
    const otherWorkspace = await seedWorkspace(otherOwner.internalId);
    const otherAuthed = await ctx.asUser(otherOwner.discordUserId);

    const otherRes = await otherAuthed.fetch(
      `/api/v1/workspaces/${otherWorkspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: memberEmail }) },
    );
    assert.strictEqual(otherRes.status, 201);
  });

  it("rejects a second invite for the same workspace and email", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const authed = await ctx.asUser(owner.discordUserId);

    const inviteEmail = `${randomUUID()}@example.com`;
    const first = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: inviteEmail }) },
    );
    assert.strictEqual(first.status, 201);

    // Re-inviting the same email (any casing) to the same workspace is rejected.
    const second = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: inviteEmail.toUpperCase() }) },
    );
    assert.strictEqual(second.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(second)).code,
      "WORKSPACE_ALREADY_INVITED",
    );

    const count = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({
        workspaceId: new Types.ObjectId(workspace.id),
        email: inviteEmail.toLowerCase(),
      });
    assert.strictEqual(count, 1);
  });

  it("fails with service-unavailable and persists no row when SMTP is down", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const authed = await ctx.asUser(owner.discordUserId);

    // Swap in a service with no transport to simulate SMTP being unconfigured.
    ctx.container.workspacesService = new WorkspacesService({
      config: ctx.container.config,
      smtpTransport: null,
      workspaceRepository: ctx.container.workspaceRepository,
      userRepository: ctx.container.userRepository,
      userFeedRepository: ctx.container.userFeedRepository,
      emailVerificationService: new EmailVerificationService({
        config: ctx.container.config,
        smtpTransport: null,
        emailVerificationRepository: ctx.container.emailVerificationRepository,
        userRepository: ctx.container.userRepository,
      }),
      redditApiService: ctx.container.redditApiService,
    });

    const inviteEmail = `${randomUUID()}@example.com`;
    const res = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: inviteEmail }) },
    );
    assert.strictEqual(res.status, 503);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INVITE_EMAIL_UNAVAILABLE",
    );

    // A failed send must leave no stranded invitation row.
    const count = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({
        workspaceId: new Types.ObjectId(workspace.id),
        email: inviteEmail.toLowerCase(),
      });
    assert.strictEqual(count, 0);
  });

  it("returns 404 WORKSPACE_NOT_FOUND for a non-member trying to create or list invites", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const outsider = await seedUser();
    const authed = await ctx.asUser(outsider.discordUserId);

    // A non-member cannot tell whether the workspace exists: both create and
    // list surface as 404 WORKSPACE_NOT_FOUND, the same as an unknown slug.
    const createRes = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      {
        method: "POST",
        body: JSON.stringify({ email: `${randomUUID()}@example.com` }),
      },
    );
    assert.strictEqual(createRes.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(createRes)).code,
      "WORKSPACE_NOT_FOUND",
    );

    const listRes = await authed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
    );
    assert.strictEqual(listRes.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(listRes)).code,
      "WORKSPACE_NOT_FOUND",
    );

    assert.strictEqual(sent.length, 0);
  });

  // --- Invite-scoped email verification send (POST /:inviteId/verification) ---

  // Creates a workspace + a pending invite to `invitedEmail`, returning the
  // invite id. The notification send is cleared from `sent` so verification-send
  // assertions start clean.
  async function seedInvite(
    invitedEmail: string,
  ): Promise<{ inviteId: string }> {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/invites`,
      { method: "POST", body: JSON.stringify({ email: invitedEmail }) },
    );
    assert.strictEqual(res.status, 201);
    const body = await readJson<InviteResult>(res);
    sent.length = 0;
    return { inviteId: body.result.id };
  }

  it("sends a verification code when the submitted address matches the invited address", async () => {
    const invitedEmail = `invitee-${randomUUID()}@example.com`;
    const { inviteId } = await seedInvite(invitedEmail);

    // A separate invitee user (no verified email yet) requests a code for the
    // invited address through the invite-scoped endpoint.
    const invitee = await seedUser();
    const authed = await ctx.asUser(invitee.discordUserId);

    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/verification`,
      { method: "POST", body: JSON.stringify({ email: invitedEmail }) },
    );
    assert.strictEqual(res.status, 200);

    // Exactly one code mail, to the invited address.
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0]?.to, invitedEmail.toLowerCase());
  });

  it("does NOT send a code when the submitted address does not match the invited address", async () => {
    const invitedEmail = `invitee-${randomUUID()}@example.com`;
    const { inviteId } = await seedInvite(invitedEmail);

    const invitee = await seedUser();
    const authed = await ctx.asUser(invitee.discordUserId);

    const unrelatedEmail = `unrelated-${randomUUID()}@example.com`;
    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/verification`,
      { method: "POST", body: JSON.stringify({ email: unrelatedEmail }) },
    );
    assert.strictEqual(res.status, 200);

    // No mail at all — the unrelated address never receives a code.
    assert.strictEqual(sent.length, 0);
    assert.ok(!sent.some((s) => s.to === unrelatedEmail.toLowerCase()));
  });

  it("returns an identical response for a match, a mismatch, and an unknown invite (no harvesting oracle)", async () => {
    const invitedEmail = `invitee-${randomUUID()}@example.com`;
    const { inviteId } = await seedInvite(invitedEmail);

    const invitee = await seedUser();
    const authed = await ctx.asUser(invitee.discordUserId);

    const matchRes = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/verification`,
      { method: "POST", body: JSON.stringify({ email: invitedEmail }) },
    );
    const mismatchRes = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/verification`,
      {
        method: "POST",
        body: JSON.stringify({ email: `nope-${randomUUID()}@example.com` }),
      },
    );
    const unknownRes = await authed.fetch(
      `/api/v1/workspace-invites/${new Types.ObjectId().toString()}/verification`,
      {
        method: "POST",
        body: JSON.stringify({ email: `nope-${randomUUID()}@example.com` }),
      },
    );

    // Status and body must be byte-identical across all three: the response can
    // never reveal whether the address matched or whether the invite exists.
    assert.strictEqual(matchRes.status, 200);
    assert.strictEqual(mismatchRes.status, 200);
    assert.strictEqual(unknownRes.status, 200);

    const matchBody = await matchRes.text();
    const mismatchBody = await mismatchRes.text();
    const unknownBody = await unknownRes.text();
    assert.strictEqual(mismatchBody, matchBody);
    assert.strictEqual(unknownBody, matchBody);
  });

  it("requires the workspaces feature flag", async () => {
    const invitedEmail = `invitee-${randomUUID()}@example.com`;
    const { inviteId } = await seedInvite(invitedEmail);

    // A user WITHOUT the workspaces feature flag.
    const discordUserId = randomUUID();
    await ctx.container.userRepository.create({ discordUserId });
    const authed = await ctx.asUser(discordUserId);

    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/verification`,
      { method: "POST", body: JSON.stringify({ email: invitedEmail }) },
    );
    assert.notStrictEqual(res.status, 200);
    assert.strictEqual(sent.length, 0);
  });
});
