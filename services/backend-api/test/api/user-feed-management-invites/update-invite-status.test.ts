import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import {
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../../src/repositories/shared/enums";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

interface UpdateInviteStatusResponse {
  result: { status: string };
}

interface ErrorResponse {
  code: string;
  message: string;
}

describe(
  "PATCH /api/v1/user-feed-management-invites/:id/status",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACCEPTED" }),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/invalid-id/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "ACCEPTED" }),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when invite does not exist", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "ACCEPTED" }),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when user is not the invitee", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const otherUserDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherUserDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Not Invitee Status Feed",
        url: `https://example.com/not-invitee-status-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "ACCEPTED" }),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when owner tries to update status", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Owner Status Feed",
        url: `https://example.com/owner-status-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "ACCEPTED" }),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("accepts CO_MANAGE invite successfully", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Accept CoManage Feed",
        url: `https://example.com/accept-comanage-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "ACCEPTED" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UpdateInviteStatusResponse;
      assert.strictEqual(body.result.status, "SUCCESS");

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      const updatedInvite = updatedFeed?.shareManageOptions?.invites?.find(
        (i) => i.id === invite.id,
      );
      assert.ok(updatedInvite);
      assert.strictEqual(updatedInvite.status, UserFeedManagerStatus.Accepted);
    });

    it("declines invite successfully", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Decline Feed",
        url: `https://example.com/decline-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "DECLINED" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UpdateInviteStatusResponse;
      assert.strictEqual(body.result.status, "SUCCESS");

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      const updatedInvite = updatedFeed?.shareManageOptions?.invites?.find(
        (i) => i.id === invite.id,
      );
      assert.ok(updatedInvite);
      assert.strictEqual(updatedInvite.status, UserFeedManagerStatus.Declined);
    });

    it("accepts TRANSFER invite and transfers ownership", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Transfer Feed",
        url: `https://example.com/transfer-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.Transfer,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "ACCEPTED" }),
        },
      );

      assert.strictEqual(response.status, 200);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(updatedFeed.user.discordUserId, inviteeDiscordUserId);
      assert.strictEqual(
        updatedFeed.shareManageOptions?.invites?.length ?? 0,
        0,
      );
    });

    it("declines TRANSFER invite without transferring ownership", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Decline Transfer Feed",
        url: `https://example.com/decline-transfer-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.Transfer,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "DECLINED" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UpdateInviteStatusResponse;
      assert.strictEqual(body.result.status, "SUCCESS");

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(
        updatedFeed.user.discordUserId,
        ownerDiscordUserId,
        "Ownership should NOT change when declining",
      );
      const updatedInvite = updatedFeed.shareManageOptions?.invites?.find(
        (i) => i.id === invite.id,
      );
      assert.ok(updatedInvite, "Invite should still exist");
      assert.strictEqual(
        updatedInvite.status,
        UserFeedManagerStatus.Declined,
        "Invite status should be DECLINED",
      );
    });

    it("returns FEED_LIMIT_REACHED when invitee is at feed limit", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      for (let i = 0; i < 5; i++) {
        await ctx.container.userFeedRepository.create({
          title: `Existing Feed ${i}`,
          url: `https://example.com/existing-${generateSnowflake()}.xml`,
          user: { id: generateTestId(), discordUserId: inviteeDiscordUserId },
        });
      }

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Limit Test Feed",
        url: `https://example.com/feed-limit-test-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "ACCEPTED" }),
        },
      );

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as ErrorResponse;
      assert.strictEqual(body.code, "FEED_LIMIT_REACHED");
    });

    it("returns 400 when status is PENDING", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "PENDING" }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when status is invalid", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "INVALID" }),
        },
      );

      assert.strictEqual(response.status, 400);
    });
  },
);
