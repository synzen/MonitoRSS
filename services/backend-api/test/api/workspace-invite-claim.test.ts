import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface ErrorResult {
  code: string;
  message: string;
  errors: Array<{ message: string }>;
}

describe("Workspace invite claim API", () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext({
      configOverrides: { BACKEND_API_SMTP_FROM_DOMAIN: "example.com" },
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  // Seeds a user with the workspaces feature flag and (optionally) a verified
  // email, returning the internal user id + discord id.
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

  async function seedWorkspace(
    ownerUserId: string,
    name = "Test Workspace",
  ): Promise<{ id: string; slug: string }> {
    const slug = `ws-${randomUUID().slice(0, 8)}`;
    const workspace =
      await ctx.container.workspaceRepository.createWorkspaceWithOwner({
        name,
        slug,
        ownerUserId,
      });
    return { id: workspace.id, slug: workspace.slug };
  }

  async function seedInvite(
    workspaceId: string,
    email: string,
    invitedByUserId: string,
  ): Promise<string> {
    const id = ctx.container.workspaceRepository.generateInviteId();
    await ctx.container.workspaceRepository.createInvite({
      id,
      workspaceId,
      email,
      role: "admin",
      invitedByUserId,
    });
    return id;
  }

  it("returns workspace name, inviter, and a redacted email hint resolved from the row", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId, "Acme Team");
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser();
    const authed = await ctx.asUser(invitee.discordUserId);

    const res = await authed.fetch(`/api/v1/workspace-invites/${inviteId}`);
    assert.strictEqual(res.status, 200);

    const body = await readJson<{
      result: {
        id: string;
        emailHint: string;
        email?: string;
        workspaceName: string;
        invitedByUserId: string;
      };
    }>(res);
    assert.strictEqual(body.result.id, inviteId);
    // The single-invite GET is reachable by any feature-flagged user who knows
    // the id, so it must redact the address to a recognizable hint and never
    // return it in plaintext.
    assert.strictEqual(
      body.result.emailHint,
      `${invitedEmail[0]}***@example.com`,
    );
    assert.strictEqual(body.result.email, undefined);
    assert.strictEqual(body.result.workspaceName, "Acme Team");
    assert.strictEqual(body.result.invitedByUserId, owner.internalId);
  });

  it("discloses the full invited email to a caller whose verifiedEmail matches, alongside the redacted hint", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId, "Acme Team");
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    // The caller has proven ownership of the invited address, so the gate opens
    // and the full plaintext email is returned (in addition to the hint).
    const invitee = await seedUser({ verifiedEmail: invitedEmail });
    const authed = await ctx.asUser(invitee.discordUserId);

    const res = await authed.fetch(`/api/v1/workspace-invites/${inviteId}`);
    assert.strictEqual(res.status, 200);

    const body = await readJson<{
      result: { id: string; emailHint: string; email?: string };
    }>(res);
    assert.strictEqual(body.result.id, inviteId);
    assert.strictEqual(body.result.email, invitedEmail);
    assert.strictEqual(
      body.result.emailHint,
      `${invitedEmail[0]}***@example.com`,
    );
  });

  it("reports alreadyMember=false for a caller who is not yet a member", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId, "Acme Team");
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser();
    const authed = await ctx.asUser(invitee.discordUserId);

    const res = await authed.fetch(`/api/v1/workspace-invites/${inviteId}`);
    assert.strictEqual(res.status, 200);

    const body = await readJson<{ result: { alreadyMember?: boolean } }>(res);
    assert.strictEqual(body.result.alreadyMember, false);
  });

  it("reports alreadyMember=true for the owner opening their own invite, before any email verification", async () => {
    // This is the self-accept dead-end: the owner (already a member) opens an
    // invite addressed to an email they do not own yet. The flag must be true
    // here — while the owner is still unverified — so the landing page can show
    // an "already a member" state instead of pushing them through verification
    // (which would overwrite their verified email) only to fail the accept guard.
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId, "Acme Team");
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const authed = await ctx.asUser(owner.discordUserId);

    const res = await authed.fetch(`/api/v1/workspace-invites/${inviteId}`);
    assert.strictEqual(res.status, 200);

    const body = await readJson<{
      result: { alreadyMember?: boolean; email?: string };
    }>(res);
    assert.strictEqual(body.result.alreadyMember, true);
    // The owner has not verified the invited address, so it stays redacted.
    assert.strictEqual(body.result.email, undefined);
  });

  it("returns 404 WORKSPACE_INVITE_NOT_FOUND for an unknown invite id", async () => {
    const invitee = await seedUser();
    const authed = await ctx.asUser(invitee.discordUserId);

    const unknownId = ctx.container.workspaceRepository.generateInviteId();
    const res = await authed.fetch(`/api/v1/workspace-invites/${unknownId}`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INVITE_NOT_FOUND",
    );
  });

  it("accepts an invite when verifiedEmail matches: creates an admin membership and removes the invite, in one transaction", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser({ verifiedEmail: invitedEmail });
    const authed = await ctx.asUser(invitee.discordUserId);

    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/accept`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 200);

    // The accept response returns the joined workspace's slug so the client
    // can redirect the invitee straight into it.
    const body = await res.json();
    assert.strictEqual(body.result.workspaceSlug, workspace.slug);

    // Membership row created with role admin.
    const membership = await ctx.connection
      .collection("workspacememberships")
      .findOne({
        workspaceId: new Types.ObjectId(workspace.id),
        userId: new Types.ObjectId(invitee.internalId),
      });
    assert.ok(membership, "membership must be created");
    assert.strictEqual(membership.role, "admin");

    // Invite row removed.
    const remaining = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({ _id: new Types.ObjectId(inviteId) });
    assert.strictEqual(remaining, 0);
  });

  it("rejects accept with WORKSPACE_INVITE_EMAIL_UNVERIFIED (without leaking the invited email) when the user has no verified email", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser(); // no verified email
    const authed = await ctx.asUser(invitee.discordUserId);

    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/accept`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 403);
    const body = await readJson<ErrorResult>(res);
    assert.strictEqual(body.code, "WORKSPACE_INVITE_EMAIL_UNVERIFIED");
    // The code alone tells the client which case it is; the address must not be
    // echoed here (PII / IDOR harvest by a prober).
    assert.ok(
      !body.errors.some((e) => e.message === invitedEmail),
      "payload must not leak the invited email",
    );

    // No membership created, invite still pending.
    const membershipCount = await ctx.connection
      .collection("workspacememberships")
      .countDocuments({ userId: new Types.ObjectId(invitee.internalId) });
    assert.strictEqual(membershipCount, 0);
    const inviteCount = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({ _id: new Types.ObjectId(inviteId) });
    assert.strictEqual(inviteCount, 1);
  });

  it("rejects accept with WORKSPACE_INVITE_EMAIL_MISMATCH (without leaking the invited email) when verified under a different address", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser({
      verifiedEmail: `${randomUUID()}@example.com`,
    });
    const authed = await ctx.asUser(invitee.discordUserId);

    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/accept`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 403);
    const body = await readJson<ErrorResult>(res);
    assert.strictEqual(body.code, "WORKSPACE_INVITE_EMAIL_MISMATCH");
    assert.ok(
      !body.errors.some((e) => e.message === invitedEmail),
      "payload must not leak the invited email",
    );
  });

  it("rejects decline with the same granular gating codes", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const invitedEmail = `${randomUUID()}@example.com`;

    // Unverified caller.
    const unverifiedInviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );
    const unverified = await seedUser();
    const unverifiedAuthed = await ctx.asUser(unverified.discordUserId);
    const unverifiedRes = await unverifiedAuthed.fetch(
      `/api/v1/workspace-invites/${unverifiedInviteId}/decline`,
      { method: "POST" },
    );
    assert.strictEqual(unverifiedRes.status, 403);
    const unverifiedBody = await readJson<ErrorResult>(unverifiedRes);
    assert.strictEqual(
      unverifiedBody.code,
      "WORKSPACE_INVITE_EMAIL_UNVERIFIED",
    );
    assert.ok(!unverifiedBody.errors.some((e) => e.message === invitedEmail));

    // Mismatched caller.
    const mismatched = await seedUser({
      verifiedEmail: `${randomUUID()}@example.com`,
    });
    const mismatchedAuthed = await ctx.asUser(mismatched.discordUserId);
    const mismatchedRes = await mismatchedAuthed.fetch(
      `/api/v1/workspace-invites/${unverifiedInviteId}/decline`,
      { method: "POST" },
    );
    assert.strictEqual(mismatchedRes.status, 403);
    assert.strictEqual(
      (await readJson<ErrorResult>(mismatchedRes)).code,
      "WORKSPACE_INVITE_EMAIL_MISMATCH",
    );

    // The invite is still pending after both rejected attempts.
    const inviteCount = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({ _id: new Types.ObjectId(unverifiedInviteId) });
    assert.strictEqual(inviteCount, 1);
  });

  it("declines an invite when verifiedEmail matches: removes the invite row and creates no membership", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser({ verifiedEmail: invitedEmail });
    const authed = await ctx.asUser(invitee.discordUserId);

    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/decline`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 204);

    const inviteCount = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({ _id: new Types.ObjectId(inviteId) });
    assert.strictEqual(inviteCount, 0);
    const membershipCount = await ctx.connection
      .collection("workspacememberships")
      .countDocuments({ userId: new Types.ObjectId(invitee.internalId) });
    assert.strictEqual(membershipCount, 0);
  });

  it("surfaces pending invitations to a user who has verified the matching email, and not otherwise", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId, "Surfacing Team");
    const invitedEmail = `${randomUUID()}@example.com`;
    await seedInvite(workspace.id, invitedEmail, owner.internalId);

    // A user who has NOT verified the invited email sees nothing.
    const unverified = await seedUser();
    const unverifiedAuthed = await ctx.asUser(unverified.discordUserId);
    const emptyRes = await unverifiedAuthed.fetch(
      `/api/v1/workspace-invites/@me`,
    );
    assert.strictEqual(emptyRes.status, 200);
    const emptyBody = await readJson<{ result: Array<{ id: string }> }>(
      emptyRes,
    );
    assert.strictEqual(emptyBody.result.length, 0);

    // A user who HAS verified the invited email sees it surface.
    const invitee = await seedUser({ verifiedEmail: invitedEmail });
    const inviteeAuthed = await ctx.asUser(invitee.discordUserId);
    const listRes = await inviteeAuthed.fetch(`/api/v1/workspace-invites/@me`);
    assert.strictEqual(listRes.status, 200);
    const listBody = await readJson<{
      result: Array<{ email: string; workspaceName: string }>;
    }>(listRes);
    assert.strictEqual(listBody.result.length, 1);
    assert.strictEqual(listBody.result[0]?.email, invitedEmail);
    assert.strictEqual(listBody.result[0]?.workspaceName, "Surfacing Team");
  });

  it("accepting one invitation leaves the user's other pending invitations untouched", async () => {
    const sharedEmail = `${randomUUID()}@example.com`;

    const ownerA = await seedUser();
    const workspaceA = await seedWorkspace(ownerA.internalId, "Workspace A");
    const inviteA = await seedInvite(
      workspaceA.id,
      sharedEmail,
      ownerA.internalId,
    );

    const ownerB = await seedUser();
    const workspaceB = await seedWorkspace(ownerB.internalId, "Workspace B");
    const inviteB = await seedInvite(
      workspaceB.id,
      sharedEmail,
      ownerB.internalId,
    );

    const invitee = await seedUser({ verifiedEmail: sharedEmail });
    const authed = await ctx.asUser(invitee.discordUserId);

    const acceptRes = await authed.fetch(
      `/api/v1/workspace-invites/${inviteA}/accept`,
      { method: "POST" },
    );
    assert.strictEqual(acceptRes.status, 200);

    // Invite B is still pending and still surfaces in the @me list.
    const inviteBCount = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({ _id: new Types.ObjectId(inviteB) });
    assert.strictEqual(inviteBCount, 1);

    const listRes = await authed.fetch(`/api/v1/workspace-invites/@me`);
    const listBody = await readJson<{ result: Array<{ id: string }> }>(listRes);
    assert.strictEqual(listBody.result.length, 1);
    assert.strictEqual(listBody.result[0]?.id, inviteB);
  });

  it("returns 404 WORKSPACE_INVITE_NOT_FOUND when accepting an already-consumed invite", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser({ verifiedEmail: invitedEmail });
    const authed = await ctx.asUser(invitee.discordUserId);

    const firstRes = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/accept`,
      { method: "POST" },
    );
    assert.strictEqual(firstRes.status, 200);

    // The invite row is now consumed, so a second accept of the same id finds
    // nothing to claim and reports it as gone.
    const secondRes = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/accept`,
      { method: "POST" },
    );
    assert.strictEqual(secondRes.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(secondRes)).code,
      "WORKSPACE_INVITE_NOT_FOUND",
    );
  });

  it("returns 404 WORKSPACE_INVITE_NOT_FOUND when declining an invite that was already revoked", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser({ verifiedEmail: invitedEmail });
    const authed = await ctx.asUser(invitee.discordUserId);

    // The invite is revoked out from under the matching user (e.g. an admin
    // revoked it). Deleting the row directly mirrors the revoke outcome.
    await ctx.connection
      .collection("workspaceinvites")
      .deleteOne({ _id: new Types.ObjectId(inviteId) });

    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/decline`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INVITE_NOT_FOUND",
    );
  });

  it("rejects accept with WORKSPACE_INVITE_ALREADY_MEMBER when the matching user is already a member, leaving the invite pending", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    const invitedEmail = `${randomUUID()}@example.com`;
    const inviteId = await seedInvite(
      workspace.id,
      invitedEmail,
      owner.internalId,
    );

    const invitee = await seedUser({ verifiedEmail: invitedEmail });

    // Make the invitee already a member of the workspace before accepting. This
    // is the shape of the owner-accepts-own-invite bug: a user who verifies the
    // invited email onto an account that is already in the workspace must not be
    // able to consume the invitation against their existing membership.
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(workspace.id),
      userId: new Types.ObjectId(invitee.internalId),
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const authed = await ctx.asUser(invitee.discordUserId);
    const res = await authed.fetch(
      `/api/v1/workspace-invites/${inviteId}/accept`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INVITE_ALREADY_MEMBER",
    );

    // The invite row is untouched, so it can still be claimed by the intended
    // person (a different account that verifies the same address).
    const inviteCount = await ctx.connection
      .collection("workspaceinvites")
      .countDocuments({ _id: new Types.ObjectId(inviteId) });
    assert.strictEqual(inviteCount, 1);

    // The pre-existing membership is unchanged (not duplicated).
    const membershipCount = await ctx.connection
      .collection("workspacememberships")
      .countDocuments({
        workspaceId: new Types.ObjectId(workspace.id),
        userId: new Types.ObjectId(invitee.internalId),
      });
    assert.strictEqual(membershipCount, 1);
  });
});
