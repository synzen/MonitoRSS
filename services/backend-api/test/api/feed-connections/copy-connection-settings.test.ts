import { before, after, describe, it } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";
import type { IUserFeed } from "../../../src/repositories/interfaces/user-feed.types";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

function testUrl(feedId: string, connectionId: string) {
  return `/api/v1/user-feeds/${feedId}/connections/discord-channels/${connectionId}/copy-connection-settings`;
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
    filters?: { expression: Record<string, unknown> };
    rateLimits?: Array<{
      id: string;
      timeWindowSeconds: number;
      limit: number;
    }>;
    mentions?: { targets?: Array<{ id: string; type: string }> | null } | null;
    splitOptions?: {
      isEnabled?: boolean;
      splitChar?: string;
      appendChar?: string;
      prependChar?: string;
    };
    customPlaceholders?: Array<{
      id: string;
      referenceName: string;
      sourcePlaceholder: string;
      steps: Array<Record<string, unknown>>;
    }>;
    details: {
      channel?: { id: string; guildId: string };
      webhook?: {
        id: string;
        token: string;
        guildId: string;
        name?: string;
        iconUrl?: string;
        threadId?: string;
      };
      embeds: unknown[];
      content?: string;
      formatter: Record<string, unknown>;
      placeholderLimits?: Array<{
        placeholder: string;
        characterCount: number;
        appendString?: string;
      }>;
      enablePlaceholderFallback?: boolean;
      forumThreadTitle?: string;
      forumThreadTags?: Array<{ id: string; filters?: unknown }>;
      componentRows?: Array<{ id: string; components?: unknown[] }>;
      componentsV2?: Array<Record<string, unknown>>;
    };
  }>;
}

async function createTestFeedWithConnections(
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
    {
      id: generateTestId(),
      name: "target-conn",
      details: {
        channel: { id: "ch-2", guildId: "guild-1" },
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
    sourceConnectionId: feed.connections.discordChannels[0]!.id,
    targetConnectionId: feed.connections.discordChannels[1]!.id,
  };
}

function validBody(targetConnectionId: string) {
  return {
    properties: ["content"],
    targetDiscordChannelConnectionIds: [targetConnectionId],
  };
}

async function setupCopyTest(
  sourceOverrides: Record<string, unknown>,
  targetOverrides: Record<string, unknown>,
  properties: string[],
) {
  const discordUserId = generateSnowflake();
  const user = await ctx.asUser(discordUserId);
  const sourceId = generateTestId();
  const targetId = generateTestId();

  const baseSource = {
    id: sourceId,
    name: "source",
    details: {
      channel: { id: "ch-1", guildId: "guild-1" },
      embeds: [],
      formatter: {},
    },
  };

  const baseTarget = {
    id: targetId,
    name: "target",
    details: {
      channel: { id: "ch-2", guildId: "guild-1" },
      embeds: [],
      formatter: {},
    },
  };

  const source = mergeConnection(baseSource, sourceOverrides);
  const target = mergeConnection(baseTarget, targetOverrides);

  const { feedId } = await createTestFeedWithConnections(ctx, {
    discordUserId,
    connections: [source as never, target as never],
  });

  const response = await user.fetch(testUrl(feedId, sourceId), {
    method: "POST",
    body: JSON.stringify({
      properties,
      targetDiscordChannelConnectionIds: [targetId],
    }),
  });

  return { feedId, sourceId, targetId, response };
}

function mergeConnection(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    if (key === "details" && typeof overrides[key] === "object") {
      result[key] = {
        ...(base[key] as Record<string, unknown>),
        ...(overrides[key] as Record<string, unknown>),
      };
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

function getTargetConnection(feed: IUserFeed, targetId: string) {
  return feed.connections.discordChannels.find((c) => c.id === targetId)!;
}

describe(
  "POST /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/copy-connection-settings",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        testUrl(generateTestId(), generateTestId()),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            properties: ["content"],
            targetDiscordChannelConnectionIds: ["some-id"],
          }),
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
          body: JSON.stringify({
            properties: ["content"],
            targetDiscordChannelConnectionIds: ["some-id"],
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for feed owned by different user", async () => {
      const otherUser = await ctx.asUser(generateSnowflake());
      const { feedId, sourceConnectionId, targetConnectionId } =
        await createTestFeedWithConnections(ctx);

      const response = await otherUser.fetch(
        testUrl(feedId, sourceConnectionId),
        {
          method: "POST",
          body: JSON.stringify(validBody(targetConnectionId)),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for non-existent connectionId", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, targetConnectionId } =
        await createTestFeedWithConnections(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId, generateTestId()), {
        method: "POST",
        body: JSON.stringify(validBody(targetConnectionId)),
      });
      assert.strictEqual(response.status, 404);
    });

    it("returns 204 for successful copy (owner)", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, sourceConnectionId, targetConnectionId } =
        await createTestFeedWithConnections(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId, sourceConnectionId), {
        method: "POST",
        body: JSON.stringify(validBody(targetConnectionId)),
      });

      assert.strictEqual(response.status, 204);
    });

    it("returns 204 for shared manager (unrestricted)", async () => {
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);
      const { feedId, sourceConnectionId, targetConnectionId } =
        await createTestFeedWithConnections(ctx, {
          shareManageOptions: {
            invites: [
              {
                discordUserId: managerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
              },
            ],
          },
        });

      const response = await user.fetch(testUrl(feedId, sourceConnectionId), {
        method: "POST",
        body: JSON.stringify(validBody(targetConnectionId)),
      });

      assert.strictEqual(response.status, 204);
    });

    it("returns 404 for shared manager without connection access", async () => {
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);

      const allowedConnectionId = generateTestId();
      const blockedConnectionId = generateTestId();
      const targetConnectionId = generateTestId();

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
            {
              id: targetConnectionId,
              name: "target-conn",
              details: {
                channel: { id: "ch-3", guildId: "guild-1" },
                embeds: [],
                formatter: {},
              },
            } as never,
          ],
        },
      });

      const response = await user.fetch(testUrl(feed.id, blockedConnectionId), {
        method: "POST",
        body: JSON.stringify(validBody(targetConnectionId)),
      });

      assert.strictEqual(response.status, 404);
    });

    it("returns 204 for admin accessing other user's feed", async () => {
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
        const { feedId, sourceConnectionId, targetConnectionId } =
          await createTestFeedWithConnections(adminCtx);

        const response = await adminUser.fetch(
          testUrl(feedId, sourceConnectionId),
          {
            method: "POST",
            body: JSON.stringify(validBody(targetConnectionId)),
          },
        );

        assert.strictEqual(response.status, 204);
      } finally {
        await adminCtx.teardown();
      }
    });

    it("returns 400 for missing properties field", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, sourceConnectionId } =
        await createTestFeedWithConnections(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId, sourceConnectionId), {
        method: "POST",
        body: JSON.stringify({
          targetDiscordChannelConnectionIds: ["some-id"],
        }),
      });
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for invalid enum values in properties", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, sourceConnectionId } =
        await createTestFeedWithConnections(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId, sourceConnectionId), {
        method: "POST",
        body: JSON.stringify({
          properties: ["invalidSetting"],
          targetDiscordChannelConnectionIds: ["some-id"],
        }),
      });
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for empty properties array", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, sourceConnectionId } =
        await createTestFeedWithConnections(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId, sourceConnectionId), {
        method: "POST",
        body: JSON.stringify({
          properties: [],
          targetDiscordChannelConnectionIds: ["some-id"],
        }),
      });
      assert.strictEqual(response.status, 400);
    });

    it("verifies settings are actually copied in the database", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const sourceId = generateTestId();
      const targetId = generateTestId();

      const { feedId } = await createTestFeedWithConnections(ctx, {
        discordUserId,
        connections: [
          {
            id: sourceId,
            name: "source",
            details: {
              channel: { id: "ch-1", guildId: "guild-1" },
              embeds: [],
              content: "source-content",
              formatter: {},
            },
          },
          {
            id: targetId,
            name: "target",
            details: {
              channel: { id: "ch-2", guildId: "guild-1" },
              embeds: [],
              content: "original-content",
              formatter: {},
            },
          },
        ],
      });

      const response = await user.fetch(testUrl(feedId, sourceId), {
        method: "POST",
        body: JSON.stringify({
          properties: ["content"],
          targetDiscordChannelConnectionIds: [targetId],
        }),
      });

      assert.strictEqual(response.status, 204);

      const updatedFeed =
        await ctx.container.userFeedRepository.findById(feedId);
      const targetConnection = updatedFeed!.connections.discordChannels.find(
        (c) => c.id === targetId,
      );

      assert.strictEqual(targetConnection!.details.content, "source-content");
    });

    it("returns 204 for shared manager copying with allowed source connection", async () => {
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);
      const sourceId = generateTestId();
      const targetId = generateTestId();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: `https://example.com/feed-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId: generateSnowflake() },
        shareManageOptions: {
          invites: [
            {
              discordUserId: managerDiscordUserId,
              status: UserFeedManagerStatus.Accepted,
              connections: [
                { connectionId: sourceId },
                { connectionId: targetId },
              ],
            },
          ],
        },
        connections: {
          discordChannels: [
            {
              id: sourceId,
              name: "source",
              details: {
                channel: { id: "ch-1", guildId: "guild-1" },
                embeds: [],
                content: "src-content",
                formatter: {},
              },
            } as never,
            {
              id: targetId,
              name: "target",
              details: {
                channel: { id: "ch-2", guildId: "guild-1" },
                embeds: [],
                formatter: {},
              },
            } as never,
          ],
        },
      });

      const response = await user.fetch(testUrl(feed.id, sourceId), {
        method: "POST",
        body: JSON.stringify({
          properties: ["content"],
          targetDiscordChannelConnectionIds: [targetId],
        }),
      });

      assert.strictEqual(response.status, 204);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      const target = getTargetConnection(updatedFeed!, targetId);
      assert.strictEqual(target.details.content, "src-content");
    });

    it("returns 500 for non-existent target connection ID", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId, sourceConnectionId } =
        await createTestFeedWithConnections(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId, sourceConnectionId), {
        method: "POST",
        body: JSON.stringify({
          properties: ["content"],
          targetDiscordChannelConnectionIds: [generateTestId()],
        }),
      });

      assert.strictEqual(response.status, 500);
    });

    describe("property copy DB verification", { concurrency: true }, () => {
      it("copies embeds", async () => {
        const sourceEmbeds = [
          { title: "Test Embed", description: "desc", url: "https://ex.com" },
        ];
        const { feedId, targetId, response } = await setupCopyTest(
          { details: { embeds: sourceEmbeds } },
          { details: { embeds: [] } },
          ["embeds"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId);
        assert.strictEqual(target.details.embeds.length, 1);
        assert.strictEqual(
          (target.details.embeds[0] as Record<string, unknown>).title,
          "Test Embed",
        );
      });

      it("copies webhook name/iconUrl/threadId when both have webhooks", async () => {
        const { feedId, targetId, response } = await setupCopyTest(
          {
            details: {
              webhook: {
                id: "wh-src",
                token: "tok-src",
                guildId: "g-1",
                name: "Source WH",
                iconUrl: "https://icon.src",
                threadId: "thread-src",
              },
              channel: undefined,
            },
          },
          {
            details: {
              webhook: {
                id: "wh-tgt",
                token: "tok-tgt",
                guildId: "g-2",
                name: "Old Name",
                iconUrl: "https://icon.old",
                threadId: "thread-old",
              },
              channel: undefined,
            },
          },
          ["webhookName", "webhookIconUrl", "webhookThread"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.webhook.name, "Source WH");
        assert.strictEqual(target.details.webhook.iconUrl, "https://icon.src");
        assert.strictEqual(target.details.webhook.threadId, "thread-src");
        assert.strictEqual(target.details.webhook.id, "wh-tgt");
        assert.strictEqual(target.details.webhook.token, "tok-tgt");
      });

      it("skips webhook props when target has no webhook", async () => {
        const { feedId, targetId, response } = await setupCopyTest(
          {
            details: {
              webhook: {
                id: "wh-src",
                token: "tok-src",
                guildId: "g-1",
                name: "Source WH",
              },
              channel: undefined,
            },
          },
          {
            details: {
              channel: { id: "ch-tgt", guildId: "g-2" },
            },
          },
          ["webhookName"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.webhook, undefined);
      });

      it("copies channel when both have channels", async () => {
        const { feedId, targetId, response } = await setupCopyTest(
          {
            details: {
              channel: { id: "ch-source", guildId: "g-source" },
            },
          },
          {
            details: {
              channel: { id: "ch-old", guildId: "g-old" },
            },
          },
          ["channel"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.channel.id, "ch-source");
        assert.strictEqual(target.details.channel.guildId, "g-source");
      });

      it("skips channel when target has no channel", async () => {
        const { feedId, targetId, response } = await setupCopyTest(
          {
            details: {
              channel: { id: "ch-source", guildId: "g-source" },
            },
          },
          {
            details: {
              webhook: {
                id: "wh-tgt",
                token: "tok-tgt",
                guildId: "g-2",
              },
              channel: undefined,
            },
          },
          ["channel"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.channel, undefined);
      });

      it("copies filters", async () => {
        const sourceFilters = {
          expression: { type: "LOGICAL", value: "AND", children: [] },
        };
        const { feedId, targetId, response } = await setupCopyTest(
          { filters: sourceFilters },
          {},
          ["filters"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.deepStrictEqual(target.filters.expression.type, "LOGICAL");
      });

      it("copies formatter properties (contentFormatTables, contentStripImages, contentDisableImageLinkPreviews, ignoreNewLines)", async () => {
        // The actual mapping in the service is:
        //   contentFormatTables → formatter.disableImageLinkPreviews
        //   contentStripImages → formatter.formatTables
        //   contentDisableImageLinkPreviews → formatter.stripImages
        //   ignoreNewLines → formatter.ignoreNewLines
        const { feedId, targetId, response } = await setupCopyTest(
          {
            details: {
              formatter: {
                disableImageLinkPreviews: true,
                formatTables: true,
                stripImages: true,
                ignoreNewLines: true,
              },
            },
          },
          {
            details: {
              formatter: {},
            },
          },
          [
            "contentFormatTables",
            "contentStripImages",
            "contentDisableImageLinkPreviews",
            "ignoreNewLines",
          ],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(
          target.details.formatter.disableImageLinkPreviews,
          true,
        );
        assert.strictEqual(target.details.formatter.formatTables, true);
        assert.strictEqual(target.details.formatter.stripImages, true);
        assert.strictEqual(target.details.formatter.ignoreNewLines, true);
      });

      it("copies splitOptions", async () => {
        const sourceSplit = {
          isEnabled: true,
          splitChar: "\\n",
          appendChar: "...",
          prependChar: ">>>",
        };
        const { feedId, targetId, response } = await setupCopyTest(
          { splitOptions: sourceSplit },
          {},
          ["splitOptions"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.splitOptions.isEnabled, true);
        assert.strictEqual(target.splitOptions.splitChar, "\\n");
      });

      it("copies deliveryRateLimits", async () => {
        const sourceRateLimits = [
          { id: generateTestId(), timeWindowSeconds: 60, limit: 5 },
        ];
        const { feedId, targetId, response } = await setupCopyTest(
          { rateLimits: sourceRateLimits },
          {},
          ["deliveryRateLimits"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.rateLimits.length, 1);
        assert.strictEqual(target.rateLimits[0].timeWindowSeconds, 60);
        assert.strictEqual(target.rateLimits[0].limit, 5);
      });

      it("copies messageMentions", async () => {
        const sourceMentions = {
          targets: [{ id: generateSnowflake(), type: "role" }],
        };
        const { feedId, targetId, response } = await setupCopyTest(
          { mentions: sourceMentions },
          {},
          ["messageMentions"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.mentions.targets.length, 1);
        assert.strictEqual(target.mentions.targets[0].type, "role");
      });

      it("copies customPlaceholders", async () => {
        const sourceCustomPlaceholders = [
          {
            id: generateTestId(),
            referenceName: "myPlaceholder",
            sourcePlaceholder: "{{title}}",
            steps: [
              {
                type: "REGEX",
                regexSearch: "foo",
                replacementString: "bar",
              },
            ],
          },
        ];
        const { feedId, targetId, response } = await setupCopyTest(
          { customPlaceholders: sourceCustomPlaceholders },
          {},
          ["customPlaceholders"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.customPlaceholders.length, 1);
        assert.strictEqual(
          target.customPlaceholders[0].referenceName,
          "myPlaceholder",
        );
      });

      it("copies placeholderLimits", async () => {
        const sourceLimits = [
          {
            placeholder: "{{title}}",
            characterCount: 100,
            appendString: "...",
          },
        ];
        const { feedId, targetId, response } = await setupCopyTest(
          { details: { placeholderLimits: sourceLimits } },
          {},
          ["placeholderLimits"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.placeholderLimits.length, 1);
        assert.strictEqual(
          target.details.placeholderLimits[0].placeholder,
          "{{title}}",
        );
        assert.strictEqual(
          target.details.placeholderLimits[0].characterCount,
          100,
        );
      });

      it("copies placeholderFallbackSetting", async () => {
        const { feedId, targetId, response } = await setupCopyTest(
          { details: { enablePlaceholderFallback: true } },
          {},
          ["placeholderFallbackSetting"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.enablePlaceholderFallback, true);
      });

      it("copies forumThreadTitle", async () => {
        const { feedId, targetId, response } = await setupCopyTest(
          { details: { forumThreadTitle: "Source Thread Title" } },
          { details: { forumThreadTitle: "Old Title" } },
          ["forumThreadTitle"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(
          target.details.forumThreadTitle,
          "Source Thread Title",
        );
      });

      it("copies forumThreadTags", async () => {
        const sourceTags = [{ id: "tag-1" }, { id: "tag-2" }];
        const { feedId, targetId, response } = await setupCopyTest(
          { details: { forumThreadTags: sourceTags } },
          {},
          ["forumThreadTags"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.forumThreadTags.length, 2);
        assert.strictEqual(target.details.forumThreadTags[0].id, "tag-1");
        assert.strictEqual(target.details.forumThreadTags[1].id, "tag-2");
      });

      it("copies components (componentRows)", async () => {
        const sourceRows = [
          {
            id: "row-1",
            components: [
              {
                id: "btn-1",
                type: 2,
                label: "Click me",
                style: 5,
                url: "https://example.com",
              },
            ],
          },
        ];
        const { feedId, targetId, response } = await setupCopyTest(
          { details: { componentRows: sourceRows } },
          {},
          ["components"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.componentRows.length, 1);
        assert.strictEqual(target.details.componentRows[0].id, "row-1");
      });

      it("copies componentsV2", async () => {
        const sourceV2 = [{ type: 10, content: "hello" }];
        const { feedId, targetId, response } = await setupCopyTest(
          { details: { componentsV2: sourceV2 } },
          {},
          ["componentsV2"],
        );

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const target = getTargetConnection(feed!, targetId) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        assert.strictEqual(target.details.componentsV2.length, 1);
        assert.strictEqual(target.details.componentsV2[0].type, 10);
      });
    });

    describe("multi-target and invariant tests", { concurrency: true }, () => {
      it("copies to multiple targets", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const sourceId = generateTestId();
        const targetId1 = generateTestId();
        const targetId2 = generateTestId();

        const { feedId } = await createTestFeedWithConnections(ctx, {
          discordUserId,
          connections: [
            {
              id: sourceId,
              name: "source",
              details: {
                channel: { id: "ch-1", guildId: "guild-1" },
                embeds: [],
                content: "multi-source-content",
                formatter: {},
              },
            },
            {
              id: targetId1,
              name: "target1",
              details: {
                channel: { id: "ch-2", guildId: "guild-1" },
                embeds: [],
                formatter: {},
              },
            },
            {
              id: targetId2,
              name: "target2",
              details: {
                channel: { id: "ch-3", guildId: "guild-1" },
                embeds: [],
                formatter: {},
              },
            },
          ],
        });

        const response = await user.fetch(testUrl(feedId, sourceId), {
          method: "POST",
          body: JSON.stringify({
            properties: ["content"],
            targetDiscordChannelConnectionIds: [targetId1, targetId2],
          }),
        });

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const t1 = getTargetConnection(feed!, targetId1);
        const t2 = getTargetConnection(feed!, targetId2);
        assert.strictEqual(t1.details.content, "multi-source-content");
        assert.strictEqual(t2.details.content, "multi-source-content");
      });

      it("source connection unchanged after copy", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const sourceId = generateTestId();
        const targetId = generateTestId();

        const sourceContent = "original-source-content";
        const sourceEmbeds = [{ title: "Source Embed" }];

        const { feedId } = await createTestFeedWithConnections(ctx, {
          discordUserId,
          connections: [
            {
              id: sourceId,
              name: "source",
              details: {
                channel: { id: "ch-1", guildId: "guild-1" },
                embeds: sourceEmbeds,
                content: sourceContent,
                formatter: { formatTables: true },
              },
            },
            {
              id: targetId,
              name: "target",
              details: {
                channel: { id: "ch-2", guildId: "guild-1" },
                embeds: [],
                content: "target-content",
                formatter: {},
              },
            },
          ],
        });

        const response = await user.fetch(testUrl(feedId, sourceId), {
          method: "POST",
          body: JSON.stringify({
            properties: ["content", "embeds", "contentStripImages"],
            targetDiscordChannelConnectionIds: [targetId],
          }),
        });

        assert.strictEqual(response.status, 204);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const source = feed!.connections.discordChannels.find(
          (c) => c.id === sourceId,
        )!;
        assert.strictEqual(source.details.content, sourceContent);
        assert.strictEqual(source.details.embeds.length, 1);
        assert.strictEqual(
          (source.details.embeds[0] as Record<string, unknown>).title,
          "Source Embed",
        );
        assert.strictEqual(source.details.formatter.formatTables, true);
      });
    });
  },
);
