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
  "DELETE /api/v1/user-feed-management-invites/:id",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}`,
        { method: "DELETE" },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/invalid-id`,
        { method: "DELETE" },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when invite does not exist", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}`,
        { method: "DELETE" },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when user is not the feed owner", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const otherUserDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherUserDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Not Owner Delete Feed",
        url: `https://example.com/not-owner-delete-${generateSnowflake()}.xml`,
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
        `/api/v1/user-feed-management-invites/${invite.id}`,
        { method: "DELETE" },
      );

      assert.strictEqual(response.status, 404);
    });

    it("deletes invite successfully", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delete Feed",
        url: `https://example.com/delete-${generateSnowflake()}.xml`,
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
        `/api/v1/user-feed-management-invites/${invite.id}`,
        { method: "DELETE" },
      );

      assert.strictEqual(response.status, 204);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      const deletedInvite = updatedFeed?.shareManageOptions?.invites?.find(
        (i) => i.id === invite.id,
      );
      assert.strictEqual(deletedInvite, undefined);
    });

    it("returns 404 when invitee tries to delete their own invite", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invitee Delete Feed",
        url: `https://example.com/invitee-delete-${generateSnowflake()}.xml`,
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
        `/api/v1/user-feed-management-invites/${invite.id}`,
        { method: "DELETE" },
      );

      assert.strictEqual(response.status, 404);
    });

    it("deletes invite preserving other invites", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const invitee1DiscordUserId = generateSnowflake();
      const invitee2DiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Multi Delete Feed",
        url: `https://example.com/multi-delete-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: invitee1DiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
            {
              discordUserId: invitee2DiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.Transfer,
            },
          ],
        },
      });

      const inviteToDelete = feed.shareManageOptions!.invites[0]!;
      const inviteToKeep = feed.shareManageOptions!.invites[1]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${inviteToDelete.id}`,
        { method: "DELETE" },
      );

      assert.strictEqual(response.status, 204);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.strictEqual(updatedFeed?.shareManageOptions?.invites?.length, 1);
      assert.strictEqual(
        updatedFeed?.shareManageOptions?.invites?.[0]?.id,
        inviteToKeep.id,
      );
    });
  },
);
