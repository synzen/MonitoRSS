import { before, after, describe, it } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

function testUrl(feedId: string, connectionId: string) {
  return `/api/v1/user-feeds/${feedId}/connections/discord-channels/${connectionId}`;
}

interface CreateTestFeedOptions {
  discordUserId?: string;
  ownerDiscordUserId?: string;
  shareManageOptions?: {
    invites: Array<{
      discordUserId: string;
      status?: UserFeedManagerStatus;
      connections?: Array<{ connectionId: string }>;
    }>;
  };
  connectionCount?: number;
}

async function createTestFeedWithConnection(
  testCtx: AppTestContext,
  options: CreateTestFeedOptions = {},
) {
  const ownerDiscordUserId =
    options.ownerDiscordUserId ?? options.discordUserId ?? generateSnowflake();

  const connections = Array.from(
    { length: options.connectionCount ?? 1 },
    () => ({
      id: generateTestId(),
      name: "test-conn",
      details: {
        channel: { id: "ch-1", guildId: "guild-1" },
        embeds: [],
        formatter: {},
      },
    }),
  ) as never[];

  const feed = await testCtx.container.userFeedRepository.create({
    title: "Test Feed",
    url: `https://example.com/feed-${generateTestId()}.xml`,
    user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    shareManageOptions: options.shareManageOptions,
    connections: { discordChannels: connections },
  });

  return {
    feedId: feed.id,
    connectionId: feed.connections.discordChannels[0]!.id,
    allConnectionIds: feed.connections.discordChannels.map((c) => c.id),
  };
}

describe(
  "DELETE /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId",
  { concurrency: true },
  () => {
    describe("Authentication and Authorization", () => {
      it("returns 401 without authentication", async () => {
        const response = await ctx.fetch(
          testUrl(generateTestId(), generateTestId()),
          {
            method: "DELETE",
          },
        );
        assert.strictEqual(response.status, 401);
      });

      it("returns 404 for non-existent feed", async () => {
        const user = await ctx.asUser(generateSnowflake());

        const response = await user.fetch(
          testUrl(generateTestId(), generateTestId()),
          {
            method: "DELETE",
          },
        );
        assert.strictEqual(response.status, 404);
      });

      it("returns 404 for invalid feedId format", async () => {
        const user = await ctx.asUser(generateSnowflake());

        const response = await user.fetch(
          testUrl("not-a-valid-object-id", generateTestId()),
          {
            method: "DELETE",
          },
        );
        assert.strictEqual(response.status, 404);
      });

      it("returns 404 for feed owned by different user", async () => {
        const otherUser = await ctx.asUser(generateSnowflake());
        const { feedId, connectionId } =
          await createTestFeedWithConnection(ctx);

        const response = await otherUser.fetch(testUrl(feedId, connectionId), {
          method: "DELETE",
        });
        assert.strictEqual(response.status, 404);
      });

      it("returns 404 for non-existent connectionId", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId } = await createTestFeedWithConnection(ctx, {
          discordUserId,
        });

        const response = await user.fetch(testUrl(feedId, generateTestId()), {
          method: "DELETE",
        });
        assert.strictEqual(response.status, 404);
      });

      it("returns 404 for shared manager without access to connection", async () => {
        const managerDiscordUserId = generateSnowflake();
        const user = await ctx.asUser(managerDiscordUserId);

        const allowedConnectionId = generateTestId();
        const blockedConnectionId = generateTestId();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId: generateSnowflake() },
          shareManageOptions: {
            invites: [
              {
                discordUserId: managerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
                connections: [{ connectionId: allowedConnectionId }],
              },
            ],
          },
          connections: {
            discordChannels: [
              {
                id: allowedConnectionId,
                name: "allowed-conn",
                details: {
                  channel: { id: "ch-1", guildId: "guild-1" },
                  embeds: [],
                  formatter: {},
                },
              } as never,
              {
                id: blockedConnectionId,
                name: "blocked-conn",
                details: {
                  channel: { id: "ch-2", guildId: "guild-1" },
                  embeds: [],
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        const response = await user.fetch(
          testUrl(feed.id, blockedConnectionId),
          {
            method: "DELETE",
          },
        );

        assert.strictEqual(response.status, 404);
      });

      it("returns 204 for shared manager with unrestricted connections", async () => {
        const managerDiscordUserId = generateSnowflake();
        const user = await ctx.asUser(managerDiscordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            shareManageOptions: {
              invites: [
                {
                  discordUserId: managerDiscordUserId,
                  status: UserFeedManagerStatus.Accepted,
                },
              ],
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "DELETE",
        });

        assert.strictEqual(response.status, 204);
      });

      it("returns 204 for admin deleting another user's connection", async () => {
        const adminUserId = generateTestId();
        const adminDiscordUserId = generateSnowflake();

        const adminCtx = await createAppTestContext({
          configOverrides: {
            BACKEND_API_ADMIN_USER_IDS: [adminUserId],
          },
        });

        try {
          const UserModel = adminCtx.connection.model("User");
          await UserModel.create({
            _id: new Types.ObjectId(adminUserId),
            discordUserId: adminDiscordUserId,
          });

          const adminUser = await adminCtx.asUser(adminDiscordUserId);
          const { feedId, connectionId } =
            await createTestFeedWithConnection(adminCtx);

          const response = await adminUser.fetch(
            testUrl(feedId, connectionId),
            {
              method: "DELETE",
            },
          );

          assert.strictEqual(response.status, 204);
        } finally {
          await adminCtx.teardown();
        }
      });
    });

    describe("Successful Deletion", () => {
      it("returns 204 for successful delete by owner", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "DELETE",
        });

        assert.strictEqual(response.status, 204);
      });

      it("actually removes the connection from the database", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        await user.fetch(testUrl(feedId, connectionId), {
          method: "DELETE",
        });

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const connection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(connection, undefined);
      });

      it("keeps other connections intact when one is deleted", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId, allConnectionIds } =
          await createTestFeedWithConnection(ctx, {
            discordUserId,
            connectionCount: 3,
          });

        const connectionToDelete = connectionId;
        const remainingConnectionIds = allConnectionIds.filter(
          (id) => id !== connectionToDelete,
        );

        await user.fetch(testUrl(feedId, connectionToDelete), {
          method: "DELETE",
        });

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const remainingConnections = feed?.connections.discordChannels ?? [];

        assert.strictEqual(remainingConnections.length, 2);
        for (const id of remainingConnectionIds) {
          assert.ok(
            remainingConnections.some((c) => c.id === id),
            `Connection ${id} should still exist`,
          );
        }
      });

      it("returns 204 for shared manager deleting allowed connection", async () => {
        const managerDiscordUserId = generateSnowflake();
        const user = await ctx.asUser(managerDiscordUserId);

        const allowedConnectionId = generateTestId();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId: generateSnowflake() },
          shareManageOptions: {
            invites: [
              {
                discordUserId: managerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
                connections: [{ connectionId: allowedConnectionId }],
              },
            ],
          },
          connections: {
            discordChannels: [
              {
                id: allowedConnectionId,
                name: "allowed-conn",
                details: {
                  channel: { id: "ch-1", guildId: "guild-1" },
                  embeds: [],
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        const response = await user.fetch(
          testUrl(feed.id, allowedConnectionId),
          {
            method: "DELETE",
          },
        );

        assert.strictEqual(response.status, 204);
      });

      it("removes deleted connection from shared manager invite permissions", async () => {
        const ownerDiscordUserId = generateSnowflake();
        const managerDiscordUserId = generateSnowflake();
        const owner = await ctx.asUser(ownerDiscordUserId);

        const connectionToDelete = generateTestId();
        const connectionToKeep = generateTestId();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
          shareManageOptions: {
            invites: [
              {
                discordUserId: managerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
                connections: [
                  { connectionId: connectionToDelete },
                  { connectionId: connectionToKeep },
                ],
              },
            ],
          },
          connections: {
            discordChannels: [
              {
                id: connectionToDelete,
                name: "conn-to-delete",
                details: {
                  channel: { id: "ch-1", guildId: "guild-1" },
                  embeds: [],
                  formatter: {},
                },
              } as never,
              {
                id: connectionToKeep,
                name: "conn-to-keep",
                details: {
                  channel: { id: "ch-2", guildId: "guild-1" },
                  embeds: [],
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        await owner.fetch(testUrl(feed.id, connectionToDelete), {
          method: "DELETE",
        });

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        const invite = updatedFeed?.shareManageOptions?.invites?.find(
          (i) => i.discordUserId === managerDiscordUserId,
        );

        assert.ok(invite, "Invite should still exist");
        assert.ok(invite.connections, "Invite connections should exist");
        assert.strictEqual(invite.connections.length, 1);
        assert.strictEqual(
          invite.connections[0]!.connectionId,
          connectionToKeep,
        );
      });
    });

    describe("Application-Owned Webhook Cleanup", () => {
      it("attempts to cleanup application-owned webhook on delete", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const webhookId = `webhook-${generateTestId()}`;

        ctx.discordMockServer.registerRoute(
          "DELETE",
          `/webhooks/${webhookId}`,
          { status: 204 },
        );

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: {
            discordChannels: [
              {
                id: generateTestId(),
                name: "webhook-conn",
                details: {
                  webhook: {
                    id: webhookId,
                    token: "webhook-token",
                    guildId: "guild-1",
                    channelId: "channel-1",
                    isApplicationOwned: true,
                  },
                  embeds: [],
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        const connectionId = feed.connections.discordChannels[0]!.id;

        const response = await user.fetch(testUrl(feed.id, connectionId), {
          method: "DELETE",
        });

        assert.strictEqual(response.status, 204);

        const webhookDeleteRequests = ctx.discordMockServer.getRequestsForPath(
          `/webhooks/${webhookId}`,
        );
        assert.strictEqual(
          webhookDeleteRequests.length,
          1,
          "Should have called Discord to delete webhook",
        );
        assert.strictEqual(webhookDeleteRequests[0]!.method, "DELETE");
      });

      it("still returns 204 if webhook cleanup fails", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const webhookId = `webhook-fail-${generateTestId()}`;

        ctx.discordMockServer.registerRoute(
          "DELETE",
          `/webhooks/${webhookId}`,
          {
            status: 500,
            body: { message: "Internal Server Error" },
          },
        );

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: {
            discordChannels: [
              {
                id: generateTestId(),
                name: "webhook-conn",
                details: {
                  webhook: {
                    id: webhookId,
                    token: "webhook-token",
                    guildId: "guild-1",
                    channelId: "channel-1",
                    isApplicationOwned: true,
                  },
                  embeds: [],
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        const connectionId = feed.connections.discordChannels[0]!.id;

        const response = await user.fetch(testUrl(feed.id, connectionId), {
          method: "DELETE",
        });

        assert.strictEqual(
          response.status,
          204,
          "Should still succeed even if webhook cleanup fails",
        );

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        assert.strictEqual(
          updatedFeed?.connections.discordChannels.length,
          0,
          "Connection should be deleted regardless of webhook cleanup failure",
        );
      });

      it("does not call webhook cleanup for non-application-owned webhooks", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const webhookId = `user-webhook-${generateTestId()}`;

        ctx.discordMockServer.registerRoute(
          "DELETE",
          `/webhooks/${webhookId}`,
          { status: 204 },
        );

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: {
            discordChannels: [
              {
                id: generateTestId(),
                name: "webhook-conn",
                details: {
                  webhook: {
                    id: webhookId,
                    token: "webhook-token",
                    guildId: "guild-1",
                    channelId: "channel-1",
                    isApplicationOwned: false,
                  },
                  embeds: [],
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        const connectionId = feed.connections.discordChannels[0]!.id;

        await user.fetch(testUrl(feed.id, connectionId), {
          method: "DELETE",
        });

        const webhookDeleteRequests = ctx.discordMockServer.getRequestsForPath(
          `/webhooks/${webhookId}`,
        );
        assert.strictEqual(
          webhookDeleteRequests.length,
          0,
          "Should NOT call Discord to delete user-owned webhook",
        );
      });

      it("does not call webhook cleanup for channel-based connections", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const channelId = `channel-${generateTestId()}`;

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: {
            discordChannels: [
              {
                id: generateTestId(),
                name: "channel-conn",
                details: {
                  channel: { id: channelId, guildId: "guild-1" },
                  embeds: [],
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        const connectionId = feed.connections.discordChannels[0]!.id;

        const response = await user.fetch(testUrl(feed.id, connectionId), {
          method: "DELETE",
        });

        assert.strictEqual(response.status, 204);

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        assert.strictEqual(
          updatedFeed?.connections.discordChannels.length,
          0,
          "Connection should be deleted",
        );
      });
    });
  },
);
