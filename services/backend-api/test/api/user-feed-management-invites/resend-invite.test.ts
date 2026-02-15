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

describe(
  "POST /api/v1/user-feed-management-invites/:id/resend",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}/resend`,
        { method: "POST" },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/invalid-id/resend`,
        { method: "POST" },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when invite does not exist", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}/resend`,
        { method: "POST" },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when user is not the feed owner", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const otherUserDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherUserDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Not Owner Resend Feed",
        url: `https://example.com/not-owner-resend-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Declined,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/resend`,
        { method: "POST" },
      );

      assert.strictEqual(response.status, 404);
    });

    it("resends invite successfully and resets status to PENDING", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Resend Feed",
        url: `https://example.com/resend-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Declined,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}/resend`,
        { method: "POST" },
      );

      assert.strictEqual(response.status, 204);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      const updatedInvite = updatedFeed?.shareManageOptions?.invites?.find(
        (i) => i.id === invite.id,
      );
      assert.ok(updatedInvite);
      assert.strictEqual(updatedInvite.status, UserFeedManagerStatus.Pending);
    });

    it("returns 404 when invitee tries to resend their own invite", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invitee Resend Feed",
        url: `https://example.com/invitee-resend-${generateSnowflake()}.xml`,
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
        `/api/v1/user-feed-management-invites/${invite.id}/resend`,
        { method: "POST" },
      );

      assert.strictEqual(response.status, 404);
    });
  },
);
