import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import { FeedLimitReachedException } from "../../src/shared/exceptions/user-feeds.exceptions";
import {
  UserManagerAlreadyInvitedException,
  UserFeedTransferRequestExistsException,
} from "../../src/shared/exceptions/user-feed-management-invites.exceptions";
import { createUserFeedManagementInvitesHarness } from "../helpers/user-feed-management-invites.harness";

describe("UserFeedManagementInvitesService", { concurrency: true }, () => {
  const harness = createUserFeedManagementInvitesHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("createInvite", () => {
    it("creates the invite", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});
      const targetDiscordUserId = ctx.generateId();

      await ctx.service.createInvite({
        feed,
        targetDiscordUserId,
        type: UserFeedManagerInviteType.CoManage,
      });

      const updatedFeed = await ctx.findById(feed.id);
      assert.ok(updatedFeed?.shareManageOptions?.invites);
      assert.strictEqual(updatedFeed.shareManageOptions.invites.length, 1);
      assert.strictEqual(
        updatedFeed.shareManageOptions.invites[0]?.discordUserId,
        targetDiscordUserId,
      );
      assert.strictEqual(
        updatedFeed.shareManageOptions.invites[0]?.status,
        UserFeedManagerStatus.Pending,
      );
      assert.strictEqual(
        updatedFeed.shareManageOptions.invites[0]?.type,
        UserFeedManagerInviteType.CoManage,
      );
    });

    it("throws UserManagerAlreadyInvitedException when user already invited", async () => {
      const ctx = harness.createContext();
      const { feed, inviteeDiscordUserId } = await ctx.createFeedWithInvite();

      await assert.rejects(
        () =>
          ctx.service.createInvite({
            feed,
            targetDiscordUserId: inviteeDiscordUserId,
            type: UserFeedManagerInviteType.CoManage,
          }),
        UserManagerAlreadyInvitedException,
      );
    });

    it("throws UserManagerAlreadyInvitedException when inviting self", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});

      await assert.rejects(
        () =>
          ctx.service.createInvite({
            feed,
            targetDiscordUserId: feed.user.discordUserId,
            type: UserFeedManagerInviteType.CoManage,
          }),
        UserManagerAlreadyInvitedException,
      );
    });

    it("throws UserFeedTransferRequestExistsException when transfer request already exists", async () => {
      const ctx = harness.createContext();
      const { feed } = await ctx.createFeedWithInvite({
        inviteType: UserFeedManagerInviteType.Transfer,
      });
      const newTargetUserId = ctx.generateId();

      await assert.rejects(
        () =>
          ctx.service.createInvite({
            feed,
            targetDiscordUserId: newTargetUserId,
            type: UserFeedManagerInviteType.Transfer,
          }),
        UserFeedTransferRequestExistsException,
      );
    });

    it("creates invite with connections", async () => {
      const ctx = harness.createContext();
      const { feed, connectionId } = await ctx.createFeedWithConnection({});
      const targetDiscordUserId = ctx.generateId();

      await ctx.service.createInvite({
        feed,
        targetDiscordUserId,
        type: UserFeedManagerInviteType.CoManage,
        connections: [{ connectionId }],
      });

      const updatedFeed = await ctx.findById(feed.id);
      assert.ok(updatedFeed?.shareManageOptions?.invites[0]?.connections);
      assert.strictEqual(
        updatedFeed.shareManageOptions.invites[0].connections.length,
        1,
      );
      assert.strictEqual(
        updatedFeed.shareManageOptions.invites[0].connections[0]?.connectionId,
        connectionId,
      );
    });

    it("throws InvalidConnectionIdException for invalid connection id", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});
      const targetDiscordUserId = ctx.generateId();
      const invalidConnectionId = ctx.generateId();

      const { InvalidConnectionIdException } =
        await import("../../src/shared/exceptions/user-feed-management-invites.exceptions");

      await assert.rejects(
        () =>
          ctx.service.createInvite({
            feed,
            targetDiscordUserId,
            type: UserFeedManagerInviteType.CoManage,
            connections: [{ connectionId: invalidConnectionId }],
          }),
        InvalidConnectionIdException,
      );
    });
  });

  describe("getUserFeedOfInviteWithOwner", () => {
    it("returns the feed", async () => {
      const ctx = harness.createContext();
      const ownerDiscordUserId = ctx.generateId();
      const { feed, inviteId } = await ctx.createFeedWithInvite({
        ownerDiscordUserId,
      });

      const result = await ctx.service.getUserFeedOfInviteWithOwner(
        inviteId,
        ownerDiscordUserId,
      );

      assert.ok(result);
      assert.strictEqual(result.id, feed.id);
    });

    it("returns null on wrong invite id", async () => {
      const ctx = harness.createContext();
      const ownerDiscordUserId = ctx.generateId();
      await ctx.createFeedWithInvite({ ownerDiscordUserId });
      const wrongInviteId = ctx.generateId();

      const result = await ctx.service.getUserFeedOfInviteWithOwner(
        wrongInviteId,
        ownerDiscordUserId,
      );

      assert.strictEqual(result, null);
    });

    it("returns null on wrong owner", async () => {
      const ctx = harness.createContext();
      const { inviteId } = await ctx.createFeedWithInvite();
      const wrongOwnerDiscordUserId = ctx.generateId();

      const result = await ctx.service.getUserFeedOfInviteWithOwner(
        inviteId,
        wrongOwnerDiscordUserId,
      );

      assert.strictEqual(result, null);
    });
  });

  describe("getUserFeedOfInviteWithInvitee", () => {
    it("returns the feed", async () => {
      const ctx = harness.createContext();
      const inviteeDiscordUserId = ctx.generateId();
      const { feed, inviteId } = await ctx.createFeedWithInvite({
        inviteeDiscordUserId,
      });

      const result = await ctx.service.getUserFeedOfInviteWithInvitee(
        inviteId,
        inviteeDiscordUserId,
      );

      assert.ok(result);
      assert.strictEqual(result.id, feed.id);
    });

    it("returns null on wrong invite id", async () => {
      const ctx = harness.createContext();
      const inviteeDiscordUserId = ctx.generateId();
      await ctx.createFeedWithInvite({ inviteeDiscordUserId });
      const wrongInviteId = ctx.generateId();

      const result = await ctx.service.getUserFeedOfInviteWithInvitee(
        wrongInviteId,
        inviteeDiscordUserId,
      );

      assert.strictEqual(result, null);
    });

    it("returns null on wrong invitee", async () => {
      const ctx = harness.createContext();
      const { inviteId } = await ctx.createFeedWithInvite();
      const wrongInviteeDiscordUserId = ctx.generateId();

      const result = await ctx.service.getUserFeedOfInviteWithInvitee(
        inviteId,
        wrongInviteeDiscordUserId,
      );

      assert.strictEqual(result, null);
    });
  });

  describe("deleteInvite", () => {
    it("deletes the invite", async () => {
      const ctx = harness.createContext();
      const { feed, inviteId } = await ctx.createFeedWithInvite();

      await ctx.service.deleteInvite(feed.id, inviteId);

      const updatedFeed = await ctx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.shareManageOptions?.invites?.length ?? 0,
        0,
      );
    });

    it("does not delete on wrong invite id", async () => {
      const ctx = harness.createContext();
      const { feed } = await ctx.createFeedWithInvite();
      const wrongInviteId = ctx.generateId();

      await ctx.service.deleteInvite(feed.id, wrongInviteId);

      const updatedFeed = await ctx.findById(feed.id);
      assert.strictEqual(updatedFeed?.shareManageOptions?.invites?.length, 1);
    });

    it("does not delete on wrong feed id", async () => {
      const ctx = harness.createContext();
      const { feed, inviteId } = await ctx.createFeedWithInvite();
      const wrongFeedId = ctx.generateId();

      await ctx.service.deleteInvite(wrongFeedId, inviteId);

      const updatedFeed = await ctx.findById(feed.id);
      assert.strictEqual(updatedFeed?.shareManageOptions?.invites?.length, 1);
    });
  });

  describe("resendInvite", () => {
    it("updates status to pending", async () => {
      const ctx = harness.createContext();
      const { feed, inviteId } = await ctx.createFeedWithInvite({
        inviteStatus: UserFeedManagerStatus.Declined,
      });

      await ctx.service.resendInvite(feed.id, inviteId);

      const updatedFeed = await ctx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.shareManageOptions?.invites[0]?.status,
        UserFeedManagerStatus.Pending,
      );
    });

    it("throws on wrong invite id", async () => {
      const ctx = harness.createContext();
      const { feed } = await ctx.createFeedWithInvite();
      const wrongInviteId = ctx.generateId();

      await assert.rejects(() =>
        ctx.service.resendInvite(feed.id, wrongInviteId),
      );
    });

    it("throws on wrong feed id", async () => {
      const ctx = harness.createContext();
      const { inviteId } = await ctx.createFeedWithInvite();
      const wrongFeedId = ctx.generateId();

      await assert.rejects(() =>
        ctx.service.resendInvite(wrongFeedId, inviteId),
      );
    });
  });

  describe("updateInvite", () => {
    it("updates the invite status", async () => {
      const ctx = harness.createContext();
      const { feed, inviteId } = await ctx.createFeedWithInvite();

      await ctx.service.updateInvite(feed, inviteId, {
        status: UserFeedManagerStatus.Declined,
      });

      const updatedFeed = await ctx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.shareManageOptions?.invites[0]?.status,
        UserFeedManagerStatus.Declined,
      );
    });

    it("no change on empty updates", async () => {
      const ctx = harness.createContext();
      const { feed, inviteId } = await ctx.createFeedWithInvite();

      await ctx.service.updateInvite(feed, inviteId, {});

      const updatedFeed = await ctx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.shareManageOptions?.invites[0]?.status,
        UserFeedManagerStatus.Pending,
      );
    });

    it("throws FeedLimitReachedException when accepting and at limit", async () => {
      const ctx = harness.createContext({ maxUserFeeds: 0 });
      const { feed, inviteId } = await ctx.createFeedWithInvite();

      await assert.rejects(
        () =>
          ctx.service.updateInvite(feed, inviteId, {
            status: UserFeedManagerStatus.Accepted,
          }),
        FeedLimitReachedException,
      );
    });

    it("transfers ownership for Transfer type", async () => {
      const ctx = harness.createContext();
      const ownerDiscordUserId = ctx.generateId();
      const inviteeDiscordUserId = ctx.generateId();
      const { feed, inviteId } = await ctx.createFeedWithInvite({
        ownerDiscordUserId,
        inviteeDiscordUserId,
        inviteType: UserFeedManagerInviteType.Transfer,
      });

      await ctx.service.updateInvite(feed, inviteId, {
        status: UserFeedManagerStatus.Accepted,
      });

      const updatedFeed = await ctx.findById(feed.id);
      assert.strictEqual(updatedFeed?.user.discordUserId, inviteeDiscordUserId);
      assert.strictEqual(
        updatedFeed?.shareManageOptions?.invites?.length ?? 0,
        0,
      );
    });

    it("updates connections", async () => {
      const ctx = harness.createContext();
      const { feed, inviteId } = await ctx.createFeedWithInvite();
      const connectionId = ctx.generateId();

      await ctx.service.updateInvite(feed, inviteId, {
        connections: [{ connectionId }],
      });

      const updatedFeed = await ctx.findById(feed.id);
      assert.ok(updatedFeed?.shareManageOptions?.invites[0]?.connections);
      assert.strictEqual(
        updatedFeed.shareManageOptions.invites[0].connections[0]?.connectionId,
        connectionId,
      );
    });

    it("removes connections when null", async () => {
      const ctx = harness.createContext();
      const connectionId = ctx.generateId();
      const { feed, inviteId } = await ctx.createFeedWithInvite({
        connections: [{ connectionId }],
      });

      await ctx.service.updateInvite(feed, inviteId, {
        connections: null,
      });

      const updatedFeed = await ctx.findById(feed.id);
      assert.ok(
        !updatedFeed?.shareManageOptions?.invites[0]?.connections ||
          updatedFeed.shareManageOptions.invites[0].connections.length === 0,
      );
    });
  });

  describe("getMyPendingInvites", () => {
    it("returns pending invites", async () => {
      const ctx = harness.createContext();
      const inviteeDiscordUserId = ctx.generateId();
      const { feed } = await ctx.createFeedWithInvite({
        inviteeDiscordUserId,
        inviteStatus: UserFeedManagerStatus.Pending,
      });

      const result =
        await ctx.service.getMyPendingInvites(inviteeDiscordUserId);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.feed.id, feed.id);
      assert.strictEqual(result[0]?.feed.title, feed.title);
      assert.strictEqual(result[0]?.feed.url, feed.url);
    });

    it("returns empty when no invites", async () => {
      const ctx = harness.createContext();
      const discordUserId = ctx.generateId();

      const result = await ctx.service.getMyPendingInvites(discordUserId);

      assert.strictEqual(result.length, 0);
    });

    it("does not return accepted invites", async () => {
      const ctx = harness.createContext();
      const inviteeDiscordUserId = ctx.generateId();
      await ctx.createFeedWithInvite({
        inviteeDiscordUserId,
        inviteStatus: UserFeedManagerStatus.Accepted,
      });

      const result =
        await ctx.service.getMyPendingInvites(inviteeDiscordUserId);

      assert.strictEqual(result.length, 0);
    });

    it("does not return declined invites", async () => {
      const ctx = harness.createContext();
      const inviteeDiscordUserId = ctx.generateId();
      await ctx.createFeedWithInvite({
        inviteeDiscordUserId,
        inviteStatus: UserFeedManagerStatus.Declined,
      });

      const result =
        await ctx.service.getMyPendingInvites(inviteeDiscordUserId);

      assert.strictEqual(result.length, 0);
    });
  });

  describe("getMyPendingInviteCount", () => {
    it("counts pending invites", async () => {
      const ctx = harness.createContext();
      const inviteeDiscordUserId = ctx.generateId();
      await ctx.createFeedWithInvite({
        inviteeDiscordUserId,
        inviteStatus: UserFeedManagerStatus.Pending,
      });
      await ctx.createFeedWithInvite({
        inviteeDiscordUserId,
        inviteStatus: UserFeedManagerStatus.Pending,
      });

      const result =
        await ctx.service.getMyPendingInviteCount(inviteeDiscordUserId);

      assert.strictEqual(result, 2);
    });

    it("returns 0 when no invites", async () => {
      const ctx = harness.createContext();
      const discordUserId = ctx.generateId();

      const result = await ctx.service.getMyPendingInviteCount(discordUserId);

      assert.strictEqual(result, 0);
    });

    it("does not count accepted invites", async () => {
      const ctx = harness.createContext();
      const inviteeDiscordUserId = ctx.generateId();
      await ctx.createFeedWithInvite({
        inviteeDiscordUserId,
        inviteStatus: UserFeedManagerStatus.Accepted,
      });

      const result =
        await ctx.service.getMyPendingInviteCount(inviteeDiscordUserId);

      assert.strictEqual(result, 0);
    });
  });
});
