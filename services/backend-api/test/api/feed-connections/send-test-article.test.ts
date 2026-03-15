import { before, after, describe, it } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import { createMockFeedHandlerApi } from "../../helpers/mock-apis";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";

const feedHandler = createMockFeedHandlerApi();
let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext({
    mockApis: { feedHandler },
  });
});

after(async () => {
  await ctx.teardown();
  await feedHandler.stop();
});

function testUrl(feedId: string, connectionId: string) {
  return `/api/v1/user-feeds/${feedId}/connections/discord-channels/${connectionId}/test`;
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
  };
}

describe(
  "POST /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/test",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        testUrl(generateTestId(), generateTestId()),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article: { id: "article-1" } }),
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
          body: JSON.stringify({ article: { id: "article-1" } }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for feed owned by different user", async () => {
      const otherUser = await ctx.asUser(generateSnowflake());
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx);

      const response = await otherUser.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({ article: { id: "article-1" } }),
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
        body: JSON.stringify({ article: { id: "article-1" } }),
      });
      assert.strictEqual(response.status, 404);
    });

    it("returns 201 for successful test article send", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({ article: { id: "article-1" } }),
      });

      assert.strictEqual(response.status, 201);
      const body = (await response.json()) as {
        result: { status: string };
      };
      assert.strictEqual(body.result.status, "SUCCESS");
    });

    it("returns 201 for shared manager", async () => {
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
        body: JSON.stringify({ article: { id: "article-1" } }),
      });

      assert.strictEqual(response.status, 201);
      const body = (await response.json()) as {
        result: { status: string };
      };
      assert.strictEqual(body.result.status, "SUCCESS");
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

      const response = await user.fetch(testUrl(feed.id, blockedConnectionId), {
        method: "POST",
        body: JSON.stringify({ article: { id: "article-1" } }),
      });

      assert.strictEqual(response.status, 404);
    });

    it("returns 201 for shared manager with unrestricted connections", async () => {
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
        body: JSON.stringify({ article: { id: "article-1" } }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 201 for admin accessing other user's feed", async () => {
      const adminUserId = generateTestId();
      const adminDiscordUserId = generateSnowflake();

      const adminCtx = await createAppTestContext({
        mockApis: { feedHandler },
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
          body: JSON.stringify({ article: { id: "article-1" } }),
        });

        assert.strictEqual(response.status, 201);
      } finally {
        await adminCtx.teardown();
      }
    });

    it("returns 404 when feed handler reports article not found", async (t) => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const articleId = feedHandler.intercept(t, {
        status: 404,
        body: { status: "NOT_FOUND" },
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({ article: { id: articleId } }),
      });

      assert.strictEqual(response.status, 404);
    });

    it("returns 422 when feed handler reports invalid custom placeholder regex", async (t) => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const articleId = feedHandler.intercept(t, {
        status: 422,
        body: {
          code: "CUSTOM_PLACEHOLDER_REGEX_EVAL",
          errors: [{ message: "bad regex" }],
        },
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: articleId },
          customPlaceholders: [
            {
              referenceName: "custom",
              sourcePlaceholder: "{{title}}",
              steps: [
                {
                  type: "REGEX",
                  regexSearch: "(",
                },
              ],
            },
          ],
        }),
      });

      assert.strictEqual(response.status, 422);
    });

    it("returns 422 when feed handler reports invalid filters regex", async (t) => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const articleId = feedHandler.intercept(t, {
        status: 422,
        body: {
          code: "FILTERS_REGEX_EVAL",
          errors: [{ message: "bad regex" }],
        },
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: articleId },
          mentions: {
            targets: [
              {
                id: "1",
                type: "role",
                filters: { expression: { type: "regex", value: "(" } },
              },
            ],
          },
        }),
      });

      assert.strictEqual(response.status, 422);
    });

    it("returns 400 when feed handler reports invalid componentsV2", async (t) => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const articleId = feedHandler.intercept(t, {
        status: 400,
        body: {
          message: [{ path: ["componentsV2"], message: "Invalid" }],
        },
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: articleId },
          componentsV2: [{ type: "invalid" }],
        }),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when article id is missing", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({ content: "hi" }),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when forumThreadTitle exceeds max length", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          forumThreadTitle: "a".repeat(101),
        }),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 201 when componentsV2 is null", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          componentsV2: null,
        }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 201 when content is null and componentRows is null (V2 mode)", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          content: null,
          componentRows: null,
          componentsV2: [
            { type: 17, components: [{ type: 10, content: "{{title}}" }] },
          ],
        }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 201 when splitOptions and mentions are null", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          splitOptions: null,
          mentions: null,
        }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 201 when applicationWebhook is provided", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const channelId = generateSnowflake();
      const webhookId = generateSnowflake();

      const connectionId = generateTestId();
      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: `https://example.com/feed-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
        connections: {
          discordChannels: [
            {
              id: connectionId,
              name: "test-conn",
              details: {
                channel: { id: channelId, guildId: "guild-1" },
                embeds: [],
                formatter: {},
              },
            } as never,
          ],
        },
      });

      ctx.discordMockServer.registerRoute(
        "GET",
        `/channels/${channelId}/webhooks`,
        {
          status: 200,
          body: [
            {
              id: webhookId,
              type: 1,
              channel_id: channelId,
              name: "app-webhook",
              token: "app-webhook-token",
              application_id: "test-client-id",
            },
          ],
        },
      );

      const response = await user.fetch(testUrl(feed.id, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          applicationWebhook: {
            channelId,
            name: "My Custom Bot",
            iconUrl: "https://example.com/avatar.png",
          },
        }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 403 when applicationWebhook is provided but bot lacks manage webhooks permission", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const channelId = generateSnowflake();

      const connectionId = generateTestId();
      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: `https://example.com/feed-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
        connections: {
          discordChannels: [
            {
              id: connectionId,
              name: "test-conn",
              details: {
                channel: { id: channelId, guildId: "guild-1" },
                embeds: [],
                formatter: {},
              },
            } as never,
          ],
        },
      });

      ctx.discordMockServer.registerRoute(
        "GET",
        `/channels/${channelId}/webhooks`,
        {
          status: 403,
          body: {
            message: "Missing Permissions",
            code: 50013,
          },
        },
      );

      const response = await user.fetch(testUrl(feed.id, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          applicationWebhook: {
            channelId,
            name: "My Custom Bot",
          },
        }),
      });

      assert.strictEqual(response.status, 403);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "WEBHOOKS_MANAGE_MISSING_PERMISSIONS");
    });

    it("returns 201 when sendAsBot is true and connection has a webhook", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const channelId = generateSnowflake();
      const webhookId = generateSnowflake();

      const connectionId = generateTestId();
      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: `https://example.com/feed-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
        connections: {
          discordChannels: [
            {
              id: connectionId,
              name: "test-conn",
              details: {
                webhook: {
                  id: webhookId,
                  token: "wh-token",
                  name: "Old Webhook Name",
                  channelId,
                  guildId: "guild-1",
                  isApplicationOwned: true,
                },
                embeds: [],
                formatter: {},
              },
            } as never,
          ],
        },
      });

      const response = await user.fetch(testUrl(feed.id, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          sendAsBot: true,
        }),
      });

      assert.strictEqual(response.status, 201);

      const body = (await response.json()) as {
        result: { status: string; apiPayload?: Record<string, unknown> };
      };
      assert.strictEqual(body.result.status, "SUCCESS");
    });

    it("returns 201 when thread and forum preview fields are supplied", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, connectionId } = await createTestFeedWithConnection(ctx, {
        discordUserId,
      });

      const response = await user.fetch(testUrl(feedId, connectionId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          forumThreadTitle: "Forum title",
          forumThreadTags: [{ id: "tag-1" }],
          channelNewThreadTitle: "Thread title",
          channelNewThreadExcludesPreview: true,
        }),
      });

      assert.strictEqual(response.status, 201);
    });
  },
);
