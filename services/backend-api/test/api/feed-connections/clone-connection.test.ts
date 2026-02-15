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
  return `/api/v1/user-feeds/${feedId}/connections/discord-channels/${connectionId}/clone`;
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
  connections?: Array<{
    id: string;
    name: string;
    details: {
      channel?: { id: string; guildId: string };
      embeds: unknown[];
      content?: string;
      formatter: Record<string, unknown>;
    };
  }>;
}

async function createTestFeedWithConnection(
  testCtx: AppTestContext,
  options: CreateTestFeedOptions = {},
) {
  const ownerDiscordUserId =
    options.ownerDiscordUserId ?? options.discordUserId ?? generateSnowflake();

  const defaultConnections = [
    {
      id: generateTestId(),
      name: "source-conn",
      details: {
        channel: { id: "ch-1", guildId: "guild-1" },
        embeds: [],
        formatter: {},
      },
    },
  ];

  const connections = options.connections ?? defaultConnections;

  const feed = await testCtx.container.userFeedRepository.create({
    title: "Test Feed",
    url: `https://example.com/feed-${generateTestId()}.xml`,
    user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    shareManageOptions: options.shareManageOptions,
    connections: { discordChannels: connections as never[] },
  });

  return {
    feedId: feed.id,
    connectionId: feed.connections.discordChannels[0]!.id,
    ownerDiscordUserId,
  };
}

function validBody(overrides?: Record<string, unknown>) {
  return {
    name: "cloned-connection",
    ...overrides,
  };
}

describe(
  "POST /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/clone",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        testUrl(generateTestId(), generateTestId()),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody()),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        testUrl(generateTestId(), generateTestId()),
        {
          method: "POST",
          body: JSON.stringify(validBody()),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for feed owned by different user", async () => {
      const otherUser = await ctx.asUser(generateSnowflake());
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx);

      const response = await otherUser.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify(validBody()),
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
        method: "POST",
        body: JSON.stringify(validBody()),
      });
      assert.strictEqual(response.status, 404);
    });

    it("returns 400 for missing name field", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({}),
      });
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for empty name", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });
      assert.strictEqual(response.status, 400);
    });

    it("returns 200 for successful clone (owner)", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify(validBody()),
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { result: { ids: string[] } };
      assert.ok(Array.isArray(body.result.ids));
    });

    it("clones connection to the same feed by default", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
        connections: [
          {
            id: generateTestId(),
            name: "source-conn",
            details: {
              channel: { id: "ch-1", guildId: "guild-1" },
              embeds: [{ title: "My Embed" }],
              content: "source-content",
              formatter: { formatTables: true },
            },
          },
        ],
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify(validBody()),
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { result: { ids: string[] } };
      assert.strictEqual(body.result.ids.length, 1);

      const updatedFeed =
        await ctx.container.userFeedRepository.findById(feedId);
      assert.strictEqual(updatedFeed!.connections.discordChannels.length, 2);

      const cloned = updatedFeed!.connections.discordChannels.find(
        (c) => c.id === body.result.ids[0],
      );
      assert.ok(cloned);
      assert.strictEqual(cloned.name, "cloned-connection");
      assert.strictEqual(cloned.details.content, "source-content");
      assert.strictEqual(cloned.details.channel?.id, "ch-1");
      assert.strictEqual(cloned.details.embeds.length, 1);
    });

    it("returns 200 for shared manager (unrestricted)", async () => {
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        shareManageOptions: {
          invites: [
            {
              discordUserId: managerDiscordUserId,
              status: UserFeedManagerStatus.Accepted,
            },
          ],
        },
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify(validBody()),
      });

      assert.strictEqual(response.status, 200);
    });

    it("returns 404 for shared manager with pending invite status", async () => {
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        shareManageOptions: {
          invites: [
            {
              discordUserId: managerDiscordUserId,
              status: UserFeedManagerStatus.Pending,
            },
          ],
        },
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify(validBody()),
      });

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for shared manager with declined invite status", async () => {
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        shareManageOptions: {
          invites: [
            {
              discordUserId: managerDiscordUserId,
              status: UserFeedManagerStatus.Declined,
            },
          ],
        },
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify(validBody()),
      });

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for shared manager without connection access", async () => {
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

      const response = await user.fetch(testUrl(feed.id, blockedConnectionId), {
        method: "POST",
        body: JSON.stringify(validBody()),
      });

      assert.strictEqual(response.status, 404);
    });

    it("returns 200 for admin accessing other user's feed", async () => {
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

        const response = await adminUser.fetch(testUrl(feedId, connectionId), {
          method: "POST",
          body: JSON.stringify(validBody()),
        });

        assert.strictEqual(response.status, 200);
      } finally {
        await adminCtx.teardown();
      }
    });

    describe(
      "targetFeedSelectionType and targetFeedIds",
      { concurrency: true },
      () => {
        it("clones to selected target feeds when targetFeedSelectionType is 'selected'", async () => {
          const discordUserId = generateSnowflake();
          const user = await ctx.asUser(discordUserId);

          const { feedId: sourceFeedId, connectionId: sourceConnectionId } =
            await createTestFeedWithConnection(ctx, { discordUserId });
          const { feedId: targetFeedId } = await createTestFeedWithConnection(
            ctx,
            { discordUserId },
          );

          const response = await user.fetch(
            testUrl(sourceFeedId, sourceConnectionId),
            {
              method: "POST",
              body: JSON.stringify(
                validBody({
                  targetFeedSelectionType: "selected",
                  targetFeedIds: [targetFeedId],
                }),
              ),
            },
          );

          assert.strictEqual(response.status, 200);
          const body = (await response.json()) as {
            result: { ids: string[] };
          };
          assert.strictEqual(body.result.ids.length, 1);

          const targetFeed =
            await ctx.container.userFeedRepository.findById(targetFeedId);
          const cloned = targetFeed!.connections.discordChannels.find(
            (c) => c.id === body.result.ids[0],
          );
          assert.ok(cloned);
          assert.strictEqual(cloned.name, "cloned-connection");
        });

        it("clones to all owned feeds when targetFeedSelectionType is 'all'", async () => {
          const discordUserId = generateSnowflake();
          const user = await ctx.asUser(discordUserId);

          const { feedId: sourceFeedId, connectionId: sourceConnectionId } =
            await createTestFeedWithConnection(ctx, { discordUserId });
          const { feedId: otherFeedId } = await createTestFeedWithConnection(
            ctx,
            { discordUserId },
          );

          const response = await user.fetch(
            testUrl(sourceFeedId, sourceConnectionId),
            {
              method: "POST",
              body: JSON.stringify(
                validBody({
                  targetFeedSelectionType: "all",
                }),
              ),
            },
          );

          assert.strictEqual(response.status, 200);
          const body = (await response.json()) as {
            result: { ids: string[] };
          };
          assert.ok(body.result.ids.length >= 2);

          const otherFeed =
            await ctx.container.userFeedRepository.findById(otherFeedId);
          const clonedOnOther = otherFeed!.connections.discordChannels.find(
            (c) => c.name === "cloned-connection",
          );
          assert.ok(clonedOnOther);
        });

        it("uses 'all' mode when targetFeedSelectionType is 'all' even if targetFeedIds are provided", async () => {
          const discordUserId = generateSnowflake();
          const user = await ctx.asUser(discordUserId);

          const { feedId: sourceFeedId, connectionId: sourceConnectionId } =
            await createTestFeedWithConnection(ctx, { discordUserId });
          const { feedId: targetFeedId } = await createTestFeedWithConnection(
            ctx,
            { discordUserId },
          );
          const { feedId: extraFeedId } = await createTestFeedWithConnection(
            ctx,
            { discordUserId },
          );

          const response = await user.fetch(
            testUrl(sourceFeedId, sourceConnectionId),
            {
              method: "POST",
              body: JSON.stringify(
                validBody({
                  targetFeedSelectionType: "all",
                  targetFeedIds: [targetFeedId],
                }),
              ),
            },
          );

          assert.strictEqual(response.status, 200);
          const body = (await response.json()) as {
            result: { ids: string[] };
          };

          const extraFeed =
            await ctx.container.userFeedRepository.findById(extraFeedId);
          const clonedOnExtra = extraFeed!.connections.discordChannels.find(
            (c) => c.name === "cloned-connection",
          );
          assert.ok(
            clonedOnExtra,
            "Should clone to extra feed too since mode is 'all', not just the specified targetFeedIds",
          );
        });

        it("defaults to 'all' when targetFeedSelectionType is omitted", async () => {
          const discordUserId = generateSnowflake();
          const user = await ctx.asUser(discordUserId);

          const { feedId: sourceFeedId, connectionId: sourceConnectionId } =
            await createTestFeedWithConnection(ctx, { discordUserId });
          const { feedId: otherFeedId } = await createTestFeedWithConnection(
            ctx,
            { discordUserId },
          );

          const response = await user.fetch(
            testUrl(sourceFeedId, sourceConnectionId),
            {
              method: "POST",
              body: JSON.stringify(validBody()),
            },
          );

          assert.strictEqual(response.status, 200);
          const body = (await response.json()) as {
            result: { ids: string[] };
          };
          assert.ok(body.result.ids.length >= 2);

          const otherFeed =
            await ctx.container.userFeedRepository.findById(otherFeedId);
          const clonedOnOther = otherFeed!.connections.discordChannels.find(
            (c) => c.name === "cloned-connection",
          );
          assert.ok(
            clonedOnOther,
            "Default mode should be 'all' and clone to all owned feeds",
          );
        });

        it("does not clone to feeds owned by other users in 'all' mode", async () => {
          const discordUserId = generateSnowflake();
          const user = await ctx.asUser(discordUserId);

          const { feedId: sourceFeedId, connectionId: sourceConnectionId } =
            await createTestFeedWithConnection(ctx, { discordUserId });
          const { feedId: otherUserFeedId } =
            await createTestFeedWithConnection(ctx);

          const response = await user.fetch(
            testUrl(sourceFeedId, sourceConnectionId),
            {
              method: "POST",
              body: JSON.stringify(
                validBody({
                  targetFeedSelectionType: "all",
                }),
              ),
            },
          );

          assert.strictEqual(response.status, 200);

          const otherUserFeed =
            await ctx.container.userFeedRepository.findById(otherUserFeedId);
          const clonedOnOtherUser =
            otherUserFeed!.connections.discordChannels.find(
              (c) => c.name === "cloned-connection",
            );
          assert.strictEqual(
            clonedOnOtherUser,
            undefined,
            "Should NOT clone to feeds owned by other users",
          );
        });

        it("clones to multiple selected target feeds", async () => {
          const discordUserId = generateSnowflake();
          const user = await ctx.asUser(discordUserId);

          const { feedId: sourceFeedId, connectionId: sourceConnectionId } =
            await createTestFeedWithConnection(ctx, { discordUserId });
          const { feedId: target1 } = await createTestFeedWithConnection(ctx, {
            discordUserId,
          });
          const { feedId: target2 } = await createTestFeedWithConnection(ctx, {
            discordUserId,
          });

          const response = await user.fetch(
            testUrl(sourceFeedId, sourceConnectionId),
            {
              method: "POST",
              body: JSON.stringify(
                validBody({
                  targetFeedSelectionType: "selected",
                  targetFeedIds: [target1, target2],
                }),
              ),
            },
          );

          assert.strictEqual(response.status, 200);
          const body = (await response.json()) as {
            result: { ids: string[] };
          };
          assert.strictEqual(body.result.ids.length, 2);

          const feed1 =
            await ctx.container.userFeedRepository.findById(target1);
          const feed2 =
            await ctx.container.userFeedRepository.findById(target2);
          assert.ok(
            feed1!.connections.discordChannels.find(
              (c) => c.name === "cloned-connection",
            ),
          );
          assert.ok(
            feed2!.connections.discordChannels.find(
              (c) => c.name === "cloned-connection",
            ),
          );
        });
      },
    );

    describe("targetFeedSearch with 'all' mode", { concurrency: true }, () => {
      it("filters feeds by search term in 'all' mode", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const searchKey = `unique-search-key-${generateTestId()}`;

        const sourceConnectionId = generateTestId();
        const sourceFeed = await ctx.container.userFeedRepository.create({
          title: `${searchKey}-source`,
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: {
            discordChannels: [
              {
                id: sourceConnectionId,
                name: "source-conn",
                details: {
                  channel: { id: "ch-1", guildId: "guild-1" },
                  embeds: [],
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        const matchingFeed = await ctx.container.userFeedRepository.create({
          title: `${searchKey}-matching`,
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: { discordChannels: [] },
        });

        const nonMatchingFeed = await ctx.container.userFeedRepository.create({
          title: `totally-different-${generateTestId()}`,
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: { discordChannels: [] },
        });

        const response = await user.fetch(
          testUrl(sourceFeed.id, sourceConnectionId),
          {
            method: "POST",
            body: JSON.stringify(
              validBody({
                targetFeedSelectionType: "all",
                targetFeedSearch: searchKey,
              }),
            ),
          },
        );

        assert.strictEqual(response.status, 200);

        const updatedMatching = await ctx.container.userFeedRepository.findById(
          matchingFeed.id,
        );
        const clonedOnMatching =
          updatedMatching!.connections.discordChannels.find(
            (c) => c.name === "cloned-connection",
          );
        assert.ok(
          clonedOnMatching,
          "Should clone to feed matching the search term",
        );

        const updatedNonMatching =
          await ctx.container.userFeedRepository.findById(nonMatchingFeed.id);
        const clonedOnNonMatching =
          updatedNonMatching!.connections.discordChannels.find(
            (c) => c.name === "cloned-connection",
          );
        assert.strictEqual(
          clonedOnNonMatching,
          undefined,
          "Should NOT clone to feed not matching the search term",
        );
      });
    });

    describe("cloned connection data integrity", { concurrency: true }, () => {
      it("preserves source connection data in the clone", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const connId = generateTestId();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: {
            discordChannels: [
              {
                id: connId,
                name: "source-conn",
                details: {
                  channel: { id: "ch-1", guildId: "guild-1" },
                  embeds: [{ title: "Test Embed", description: "desc" }],
                  content: "test content {{title}}",
                  formatter: { formatTables: true, stripImages: true },
                },
              } as never,
            ],
          },
        });

        const response = await user.fetch(testUrl(feed.id, connId), {
          method: "POST",
          body: JSON.stringify(validBody()),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as { result: { ids: string[] } };

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        const cloned = updatedFeed!.connections.discordChannels.find(
          (c) => c.id === body.result.ids[0],
        )!;

        assert.strictEqual(cloned.name, "cloned-connection");
        assert.strictEqual(cloned.details.content, "test content {{title}}");
        assert.strictEqual(cloned.details.channel?.id, "ch-1");
        assert.strictEqual(cloned.details.channel?.guildId, "guild-1");
        assert.strictEqual(cloned.details.embeds.length, 1);
        assert.strictEqual(cloned.details.formatter.formatTables, true);
        assert.strictEqual(cloned.details.formatter.stripImages, true);
      });

      it("gives the cloned connection a new unique id", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "POST",
          body: JSON.stringify(validBody()),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as { result: { ids: string[] } };
        assert.notStrictEqual(
          body.result.ids[0],
          connectionId,
          "Cloned connection should have a different id from the source",
        );
      });

      it("does not modify the source connection", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const connId = generateTestId();

        const feed = await ctx.container.userFeedRepository.create({
          title: "Test Feed",
          url: `https://example.com/feed-${generateTestId()}.xml`,
          user: { id: generateTestId(), discordUserId },
          connections: {
            discordChannels: [
              {
                id: connId,
                name: "original-name",
                details: {
                  channel: { id: "ch-1", guildId: "guild-1" },
                  embeds: [{ title: "Original" }],
                  content: "original-content",
                  formatter: {},
                },
              } as never,
            ],
          },
        });

        const response = await user.fetch(testUrl(feed.id, connId), {
          method: "POST",
          body: JSON.stringify(validBody({ name: "new-name" })),
        });

        assert.strictEqual(response.status, 200);

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        const source = updatedFeed!.connections.discordChannels.find(
          (c) => c.id === connId,
        )!;
        assert.strictEqual(source.name, "original-name");
        assert.strictEqual(source.details.content, "original-content");
      });
    });
  },
);
