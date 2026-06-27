import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { WorkspacesService } from "../../src/features/workspaces/workspaces.service";
import type { SmtpTransport } from "../../src/infra/smtp";
import { buildPaddleCustomer } from "../helpers/paddle-fixtures";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface ErrorResult {
  code: string;
}

interface MembersListResult {
  result: Array<{ userId: string; role: string; discordUserId: string }>;
}

describe("Workspace ownership transfer API", () => {
  let ctx: AppTestContext;
  let sent: Array<{ to: string; subject: string; html: string }>;

  before(async () => {
    // A from-domain is required for the sender address (createFromFormatter);
    // the capturing transport below stands in for an actual SMTP server.
    ctx = await createAppTestContext({
      configOverrides: { BACKEND_API_SMTP_FROM_DOMAIN: "example.com" },
    });
  });

  // Swap in a capturing mailer so the new-owner notification is observable
  // without an SMTP server (the harness leaves SMTP unconfigured).
  beforeEach(() => {
    sent = [];
    const fakeTransport = {
      sendMail: async (msg: { to: string; subject: string; html: string }) => {
        sent.push({
          to: msg.to,
          subject: String(msg.subject),
          html: String(msg.html),
        });
        return {};
      },
    } as unknown as SmtpTransport;

    ctx.container.workspacesService = new WorkspacesService({
      config: ctx.container.config,
      smtpTransport: fakeTransport,
      workspaceRepository: ctx.container.workspaceRepository,
      userRepository: ctx.container.userRepository,
      userFeedRepository: ctx.container.userFeedRepository,
      supporterRepository: ctx.container.supporterRepository,
      emailVerificationService: ctx.container.emailVerificationService,
      redditApiService: ctx.container.redditApiService,
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  async function seedUser(
    options: { verifiedEmail?: boolean } = {},
  ): Promise<{ discordUserId: string; internalId: string }> {
    const discordUserId = randomUUID();
    await ctx.container.userRepository.create({
      discordUserId,
      email: `${discordUserId}@example.com`,
    });

    const set: Record<string, unknown> = { "featureFlags.workspaces": true };

    if (options.verifiedEmail) {
      set.verifiedEmail = `verified-${discordUserId}@example.com`;
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

  async function addMembership(
    workspaceId: string,
    userId: string,
    role: "owner" | "admin",
  ): Promise<void> {
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it("lets an owner transfer ownership to a verified admin; roles swap, one owner remains", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const target = await seedUser({ verifiedEmail: true });
    await addMembership(workspace.id, target.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${target.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 200);

    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);

    const targetEntry = list.result.find((m) => m.userId === target.internalId);
    assert.strictEqual(
      targetEntry?.role,
      "owner",
      "the transfer target should now be the owner",
    );

    const previousOwnerEntry = list.result.find(
      (m) => m.userId === owner.internalId,
    );
    assert.strictEqual(
      previousOwnerEntry?.role,
      "admin",
      "the previous owner should be demoted to admin",
    );

    assert.strictEqual(
      list.result.filter((m) => m.role === "owner").length,
      1,
      "the workspace should have exactly one owner after the transfer",
    );
  });

  it("emails the new owner on a successful transfer", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const target = await seedUser({ verifiedEmail: true });
    await addMembership(workspace.id, target.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${target.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 200);

    assert.strictEqual(sent.length, 1, "exactly one notification should be sent");
    assert.strictEqual(
      sent[0]?.to,
      `verified-${target.discordUserId}@example.com`,
      "the notification should go to the new owner's verified email",
    );
    assert.match(sent[0]?.html ?? "", /now the owner/i);
    // No live subscription on this workspace, so no billing-tail note.
    assert.doesNotMatch(sent[0]?.html ?? "", /payment method/i);
  });

  it("includes the billing-tail note when the workspace has a live subscription", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);
    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspace.id,
      buildPaddleCustomer({ subscriptionId: randomUUID() }),
    );

    const target = await seedUser({ verifiedEmail: true });
    await addMembership(workspace.id, target.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${target.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 200);

    assert.strictEqual(sent.length, 1);
    assert.match(
      sent[0]?.html ?? "",
      /payment method/i,
      "a workspace with a subscription should mention updating the payment method",
    );
  });

  it("does not fail the transfer when SMTP is unavailable", async () => {
    ctx.container.workspacesService = new WorkspacesService({
      config: ctx.container.config,
      smtpTransport: null as unknown as SmtpTransport,
      workspaceRepository: ctx.container.workspaceRepository,
      userRepository: ctx.container.userRepository,
      userFeedRepository: ctx.container.userFeedRepository,
      supporterRepository: ctx.container.supporterRepository,
      emailVerificationService: ctx.container.emailVerificationService,
      redditApiService: ctx.container.redditApiService,
    });

    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const target = await seedUser({ verifiedEmail: true });
    await addMembership(workspace.id, target.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${target.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(
      res.status,
      200,
      "the transfer should succeed even with no mailer",
    );

    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    assert.strictEqual(
      list.result.find((m) => m.userId === target.internalId)?.role,
      "owner",
    );
  });

  it("does not fail the transfer when the mailer throws; roles still swap", async () => {
    ctx.container.workspacesService = new WorkspacesService({
      config: ctx.container.config,
      smtpTransport: {
        sendMail: async () => {
          throw new Error("smtp boom");
        },
      } as unknown as SmtpTransport,
      workspaceRepository: ctx.container.workspaceRepository,
      userRepository: ctx.container.userRepository,
      userFeedRepository: ctx.container.userFeedRepository,
      supporterRepository: ctx.container.supporterRepository,
      emailVerificationService: ctx.container.emailVerificationService,
      redditApiService: ctx.container.redditApiService,
    });

    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const target = await seedUser({ verifiedEmail: true });
    await addMembership(workspace.id, target.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${target.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(
      res.status,
      200,
      "a failed new-owner notification must not fail a committed transfer",
    );

    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    assert.strictEqual(
      list.result.find((m) => m.userId === target.internalId)?.role,
      "owner",
    );
  });

  it("forbids a non-owner admin from transferring ownership; roles unchanged", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const admin = await seedUser({ verifiedEmail: true });
    await addMembership(workspace.id, admin.internalId, "admin");

    const target = await seedUser({ verifiedEmail: true });
    await addMembership(workspace.id, target.internalId, "admin");

    const adminAuthed = await ctx.asUser(admin.discordUserId);
    const res = await adminAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${target.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 403);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INSUFFICIENT_ROLE",
    );

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    assert.strictEqual(
      list.result.find((m) => m.userId === owner.internalId)?.role,
      "owner",
      "the original owner should be unchanged",
    );
    assert.strictEqual(
      list.result.filter((m) => m.role === "owner").length,
      1,
    );
  });

  it("rejects transferring to a user who is not a member; owner unchanged", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const outsider = await seedUser({ verifiedEmail: true });

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${outsider.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_TRANSFER_TARGET_INVALID",
    );

    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    assert.strictEqual(
      list.result.find((m) => m.userId === owner.internalId)?.role,
      "owner",
    );
  });

  it("rejects a non-member target as invalid, not as unverified, without disclosing their email state", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    // An outsider who is NOT a member and has no verified email. The target
    // validation must run before the email gate, so the response is the
    // membership error (TARGET_INVALID) and never reveals that this arbitrary
    // user lacks a verified email (which EMAIL_NOT_VERIFIED would leak).
    const outsider = await seedUser();

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${outsider.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_TRANSFER_TARGET_INVALID",
    );
  });

  it("rejects transferring to a member without a verified email; owner unchanged", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const unverified = await seedUser();
    await addMembership(workspace.id, unverified.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${unverified.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 403);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "EMAIL_NOT_VERIFIED",
    );

    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    assert.strictEqual(
      list.result.find((m) => m.userId === owner.internalId)?.role,
      "owner",
    );
    assert.strictEqual(
      list.result.find((m) => m.userId === unverified.internalId)?.role,
      "admin",
    );
  });

  it("rejects an owner transferring ownership to themselves; still sole owner", async () => {
    const owner = await seedUser({ verifiedEmail: true });
    const workspace = await seedWorkspace(owner.internalId);

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${owner.internalId}/transfer-ownership`,
      { method: "POST" },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_TRANSFER_TARGET_INVALID",
    );

    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    assert.strictEqual(
      list.result.find((m) => m.userId === owner.internalId)?.role,
      "owner",
    );
    assert.strictEqual(
      list.result.filter((m) => m.role === "owner").length,
      1,
    );
  });
});
