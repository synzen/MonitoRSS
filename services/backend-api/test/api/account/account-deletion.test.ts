import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { EmailVerificationService } from "../../../src/features/users/email-verification.service";
import { AccountService } from "../../../src/features/account/account.service";
import type { SmtpTransport } from "../../../src/infra/smtp";

const ENCRYPTION_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface ErrorResult {
  code: string;
}

describe("Account deletion API", () => {
  let ctx: AppTestContext;
  let sent: Array<{ to: string; subject: string; html: string }>;

  before(async () => {
    ctx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_SMTP_FROM_DOMAIN: "example.com",
        BACKEND_API_ENCRYPTION_KEY_HEX: ENCRYPTION_KEY_HEX,
      },
    });
  });

  // A capturing mailer makes the OTP observable without an SMTP server, and a
  // fresh AccountService (wired to the same email-verification instance) is
  // rebuilt per test so the captured code matches the one the deletion checks.
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

    const emailVerificationService = new EmailVerificationService({
      config: ctx.container.config,
      smtpTransport: fakeTransport,
      emailVerificationRepository: ctx.container.emailVerificationRepository,
      userRepository: ctx.container.userRepository,
    });

    ctx.container.emailVerificationService = emailVerificationService;
    ctx.container.accountService = new AccountService({
      userRepository: ctx.container.userRepository,
      emailVerificationService,
      usersService: ctx.container.usersService,
      userFeedsService: ctx.container.userFeedsService,
      workspacesService: ctx.container.workspacesService,
      supportersService: ctx.container.supportersService,
      userFeedLimitOverrideRepository:
        ctx.container.userFeedLimitOverrideRepository,
      supporterRepository: ctx.container.supporterRepository,
      patronRepository: ctx.container.patronRepository,
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  async function seedUser(): Promise<{
    discordUserId: string;
    internalId: string;
    verifiedEmail: string;
  }> {
    const discordUserId = randomUUID();
    const verifiedEmail = `verified-${discordUserId}@example.com`;

    await ctx.container.userRepository.create({
      discordUserId,
      email: `${discordUserId}@example.com`,
    });

    await ctx.connection.collection("users").updateOne(
      { discordUserId },
      {
        $set: {
          verifiedEmail,
          verifiedEmailVerifiedAt: new Date(),
        },
      },
    );

    const internalId =
      await ctx.container.userRepository.findIdByDiscordId(discordUserId);

    return { discordUserId, internalId: internalId as string, verifiedEmail };
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

  // Drives a code through the real send endpoint and returns it by reading the
  // captured email, then the deletion endpoint with that code.
  async function requestCode(
    authed: { fetch(p: string, o?: RequestInit): Promise<Response> },
  ): Promise<string> {
    const res = await authed.fetch("/api/v1/account/@me/deletion-verification", {
      method: "POST",
    });
    assert.strictEqual(res.status, 200, await res.text());

    // The code sits in the email-code cell; scope the match there so the
    // shell's stray 6-digit style constants are not picked up.
    const match = sent
      .map((m) => m.html.match(/class="email-code"[^>]*>\s*(\d{6})\s*</)?.[1])
      .find((c): c is string => !!c);
    assert.ok(match, "Expected a 6-digit code in the captured email");
    return match;
  }

  it("blocks deletion when the user is the sole owner of a workspace", async () => {
    const user = await seedUser();
    await seedWorkspace(user.internalId);

    const authed = await ctx.asUser(user.discordUserId);
    const code = await requestCode(authed);

    const res = await authed.fetch("/api/v1/account/@me", {
      method: "DELETE",
      body: JSON.stringify({ code }),
    });

    assert.strictEqual(res.status, 409);
    const body = await readJson<ErrorResult>(res);
    assert.strictEqual(body.code, "ACCOUNT_DELETE_SOLE_WORKSPACE_OWNER");

    // Nothing was deleted.
    const stillThere = await ctx.container.userRepository.findByDiscordId(
      user.discordUserId,
    );
    assert.ok(stillThere, "User must survive a blocked deletion");
  });

  it("rejects deletion with a wrong code and leaves the account intact", async () => {
    const user = await seedUser();
    const authed = await ctx.asUser(user.discordUserId);
    await requestCode(authed);

    const res = await authed.fetch("/api/v1/account/@me", {
      method: "DELETE",
      body: JSON.stringify({ code: "000000" }),
    });

    assert.strictEqual(res.status, 400);

    const stillThere = await ctx.container.userRepository.findByDiscordId(
      user.discordUserId,
    );
    assert.ok(stillThere, "A wrong code must not delete the account");
  });

  it("requires a verified email before a code can be requested", async () => {
    const discordUserId = randomUUID();
    await ctx.container.userRepository.create({
      discordUserId,
      email: `${discordUserId}@example.com`,
    });

    const authed = await ctx.asUser(discordUserId);
    const res = await authed.fetch(
      "/api/v1/account/@me/deletion-verification",
      { method: "POST" },
    );

    assert.strictEqual(res.status, 403);
    const body = await readJson<ErrorResult>(res);
    assert.strictEqual(body.code, "EMAIL_NOT_VERIFIED");
  });

  it("performs the full erasure cascade on a valid code", async () => {
    const revokeMock = mock.method(
      ctx.container.redditApiService,
      "revokeRefreshToken",
      async () => undefined,
    );

    const user = await seedUser();

    // A co-owned workspace (a second owner remains): membership is removed, the
    // workspace survives.
    const other = await seedUser();
    const coOwned = await seedWorkspace(other.internalId);
    await addMembership(coOwned.id, user.internalId, "owner");

    // A personal feed (no workspaceId).
    const feedInsert = await ctx.connection
      .collection("userfeeds")
      .insertOne({
        title: "My feed",
        url: "https://example.com/feed.xml",
        user: { discordUserId: user.discordUserId },
        healthStatus: "ok",
        connections: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const feedId = feedInsert.insertedId.toString();

    // A feed owned by someone else where this user is a co-manage invitee.
    const sharedFeed = await ctx.connection
      .collection("userfeeds")
      .insertOne({
        title: "Shared feed",
        url: "https://example.com/shared.xml",
        user: { discordUserId: other.discordUserId },
        healthStatus: "ok",
        connections: {},
        shareManageOptions: {
          invites: [
            {
              id: new Types.ObjectId(),
              type: "co-manage",
              discordUserId: user.discordUserId,
              status: "accepted",
            },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const sharedFeedId = sharedFeed.insertedId.toString();

    // An invite addressed to the user, and one the user sent, in a workspace
    // they don't own.
    const inviterWs = await seedWorkspace(other.internalId);
    await ctx.connection.collection("workspaceinvites").insertOne({
      workspaceId: new Types.ObjectId(inviterWs.id),
      email: user.verifiedEmail,
      role: "admin",
      invitedByUserId: new Types.ObjectId(other.internalId),
      lastSentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await ctx.connection.collection("workspaceinvites").insertOne({
      workspaceId: new Types.ObjectId(coOwned.id),
      email: `someone-${randomUUID()}@example.com`,
      role: "admin",
      invitedByUserId: new Types.ObjectId(user.internalId),
      lastSentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Billing records keyed by discord id and email, plus a feed-limit override.
    await ctx.container.supporterRepository.upsertPaddleCustomer(
      user.discordUserId,
      {
        customerId: "cus_1",
        email: user.verifiedEmail,
        subscription: null,
      } as never,
    );
    await ctx.connection.collection("patrons").insertOne({
      _id: `patron-${user.discordUserId}` as never,
      status: "active_patron",
      pledge: 100,
      pledgeLifetime: 100,
      name: "Patron",
      discord: user.discordUserId,
      email: user.verifiedEmail,
    });
    await ctx.container.userFeedLimitOverrideRepository.upsertIncrement(
      user.discordUserId,
      3,
    );

    // An encrypted reddit credential on the user.
    await ctx.container.usersService.setRedditCredentials({
      userId: user.internalId,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 3600,
    });

    const authed = await ctx.asUser(user.discordUserId);
    const code = await requestCode(authed);

    const res = await authed.fetch("/api/v1/account/@me", {
      method: "DELETE",
      body: JSON.stringify({ code }),
    });
    assert.strictEqual(res.status, 204, await res.text());

    // Reddit grant revoked at Reddit before local deletes.
    assert.strictEqual(revokeMock.mock.callCount(), 1);

    // Personal feed gone.
    const feedGone = await ctx.connection
      .collection("userfeeds")
      .findOne({ _id: new Types.ObjectId(feedId) });
    assert.strictEqual(feedGone, null, "Personal feed should be deleted");

    // The shared feed survives, but the user is removed from its invites.
    const shared = await ctx.connection
      .collection("userfeeds")
      .findOne({ _id: new Types.ObjectId(sharedFeedId) });
    assert.ok(shared, "Shared feed must survive");
    const invites = (shared!.shareManageOptions?.invites ?? []) as Array<{
      discordUserId: string;
    }>;
    assert.ok(
      !invites.some((i) => i.discordUserId === user.discordUserId),
      "User must be removed from co-manage invites",
    );

    // Membership gone; workspace and the other owner survive.
    const membership = await ctx.connection
      .collection("workspacememberships")
      .findOne({ userId: new Types.ObjectId(user.internalId) });
    assert.strictEqual(membership, null, "Membership should be removed");
    const ownerCount = await ctx.container.workspaceRepository.countOwners(
      coOwned.id,
    );
    assert.strictEqual(ownerCount, 1, "The other owner must remain");

    // Both invites (sent + addressed-to) gone.
    const inviteToUser = await ctx.connection
      .collection("workspaceinvites")
      .findOne({ email: user.verifiedEmail });
    assert.strictEqual(inviteToUser, null, "Invite addressed to user gone");
    const inviteByUser = await ctx.connection
      .collection("workspaceinvites")
      .findOne({ invitedByUserId: new Types.ObjectId(user.internalId) });
    assert.strictEqual(inviteByUser, null, "Invite sent by user gone");

    // Billing rows survive, but the email is stripped.
    const supporter = await ctx.connection
      .collection("supporters")
      .findOne({ _id: user.discordUserId as never });
    assert.ok(supporter, "Supporter row must be retained");
    assert.ok(
      !supporter!.paddleCustomer?.email,
      "Supporter paddle email must be stripped",
    );
    const patron = await ctx.connection
      .collection("patrons")
      .findOne({ discord: user.discordUserId });
    assert.ok(patron, "Patron row must be retained");
    assert.ok(!patron!.email, "Patron email must be stripped");

    // Override gone.
    const override = await ctx.connection
      .collection("userfeedlimitoverride")
      .findOne({ _id: user.discordUserId as never });
    assert.strictEqual(override, null, "Feed-limit override should be deleted");

    // User doc gone.
    const userGone = await ctx.container.userRepository.findByDiscordId(
      user.discordUserId,
    );
    assert.strictEqual(userGone, null, "User document should be deleted");

    revokeMock.mock.restore();
  });

  it("is idempotent: re-running after a partial deletion completes cleanly", async () => {
    const user = await seedUser();

    // Seed a personal feed only; run the full deletion once.
    await ctx.connection.collection("userfeeds").insertOne({
      title: "Feed",
      url: "https://example.com/a.xml",
      user: { discordUserId: user.discordUserId },
      healthStatus: "ok",
      connections: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await ctx.container.accountService.deleteAccount(user.discordUserId);

    // User is gone; a second run must not throw (everything already done).
    await assert.doesNotReject(
      ctx.container.accountService.deleteAccount(user.discordUserId),
    );
  });
});
