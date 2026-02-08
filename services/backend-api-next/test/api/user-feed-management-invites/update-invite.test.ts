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

interface UpdateInviteResponse {
  result: { status: string };
}

describe(
  "PATCH /api/v1/user-feed-management-invites/:id",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/invalid-id`,
        {
          method: "PATCH",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when invite does not exist", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${generateTestId()}`,
        {
          method: "PATCH",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when user is not the feed owner", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const otherUserDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherUserDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Not Owner Update Feed",
        url: `https://example.com/not-owner-update-${generateSnowflake()}.xml`,
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
        {
          method: "PATCH",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("updates connection restrictions successfully", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);
      const connectionId = generateTestId();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Update Connections Feed",
        url: `https://example.com/update-connections-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        connections: {
          discordChannels: [
            {
              id: connectionId,
              name: "test-connection",
              details: {
                embeds: [],
                formatter: {},
                channel: {
                  id: generateSnowflake(),
                  guildId: generateSnowflake(),
                },
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            } as never,
          ],
        },
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
        {
          method: "PATCH",
          body: JSON.stringify({
            connections: [{ connectionId }],
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UpdateInviteResponse;
      assert.strictEqual(body.result.status, "SUCCESS");
    });

    it("clears connection restrictions when null is passed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);
      const connectionId = generateTestId();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Clear Connections Feed",
        url: `https://example.com/clear-connections-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        connections: {
          discordChannels: [
            {
              id: connectionId,
              name: "test-connection",
              details: {
                embeds: [],
                formatter: {},
                channel: {
                  id: generateSnowflake(),
                  guildId: generateSnowflake(),
                },
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            } as never,
          ],
        },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
              connections: [{ connectionId }],
            },
          ],
        },
      });

      const invite = feed.shareManageOptions!.invites[0]!;

      const response = await user.fetch(
        `/api/v1/user-feed-management-invites/${invite.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            connections: null,
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UpdateInviteResponse;
      assert.strictEqual(body.result.status, "SUCCESS");
    });

    it("accepts empty connections array", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Empty Connections Feed",
        url: `https://example.com/empty-connections-${generateSnowflake()}.xml`,
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
        {
          method: "PATCH",
          body: JSON.stringify({
            connections: [],
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UpdateInviteResponse;
      assert.strictEqual(body.result.status, "SUCCESS");
    });

    it("returns 404 when invitee tries to update connections", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invitee Update Feed",
        url: `https://example.com/invitee-update-${generateSnowflake()}.xml`,
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
        {
          method: "PATCH",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 404);
    });
  },
);
