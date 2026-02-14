import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import { createMockFeedHandlerFilterValidationApi } from "../../helpers/mock-apis";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";

const filterValidationApi = createMockFeedHandlerFilterValidationApi();
let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext({
    mockApis: { filterValidation: filterValidationApi },
  });
});

after(async () => {
  await ctx.teardown();
  await filterValidationApi.stop();
});

beforeEach(() => {
  ctx.discordMockServer.clear();
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
  connectionOverrides?: Partial<{
    name: string;
    filters: { expression: Record<string, unknown> };
    splitOptions: { isEnabled: boolean; splitChar?: string };
    mentions: { targets: Array<{ id: string; type: string }> };
    disabledCode: string;
    customPlaceholders: Array<{
      id: string;
      referenceName: string;
      sourcePlaceholder: string;
      steps: Array<{ id: string; type: string; regexSearch?: string }>;
    }>;
    rateLimits: Array<{
      id: string;
      timeWindowSeconds: number;
      limit: number;
    }>;
    details: {
      channel?: { id: string; guildId: string } | null;
      webhook?: {
        id: string;
        token: string;
        guildId: string;
        isApplicationOwned?: boolean;
      };
      content?: string;
      embeds?: Array<{ title?: string }>;
      forumThreadTitle?: string;
      forumThreadTags?: Array<{ id: string }>;
      componentRows?: Array<{ id: string; components?: unknown[] }>;
      componentsV2?: Array<Record<string, unknown>>;
      placeholderLimits?: Array<{
        placeholder: string;
        characterCount: number;
      }>;
      formatter?: { formatTables?: boolean };
      enablePlaceholderFallback?: boolean;
    };
  }>;
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
      name: options.connectionOverrides?.name ?? "test-conn",
      filters: options.connectionOverrides?.filters,
      splitOptions: options.connectionOverrides?.splitOptions,
      mentions: options.connectionOverrides?.mentions,
      disabledCode: options.connectionOverrides?.disabledCode,
      customPlaceholders: options.connectionOverrides?.customPlaceholders,
      rateLimits: options.connectionOverrides?.rateLimits,
      details: {
        channel:
          options.connectionOverrides?.details?.channel === null
            ? undefined
            : (options.connectionOverrides?.details?.channel ??
              ({ id: "ch-1", guildId: "guild-1" } as const)),
        webhook: options.connectionOverrides?.details?.webhook,
        embeds: options.connectionOverrides?.details?.embeds ?? [],
        formatter: options.connectionOverrides?.details?.formatter ?? {},
        content: options.connectionOverrides?.details?.content,
        forumThreadTitle:
          options.connectionOverrides?.details?.forumThreadTitle,
        forumThreadTags: options.connectionOverrides?.details?.forumThreadTags,
        componentRows: options.connectionOverrides?.details?.componentRows,
        componentsV2: options.connectionOverrides?.details?.componentsV2,
        placeholderLimits:
          options.connectionOverrides?.details?.placeholderLimits,
        enablePlaceholderFallback:
          options.connectionOverrides?.details?.enablePlaceholderFallback,
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

function setupDiscordMocks(
  channelId: string,
  guildId: string,
  accessToken: string,
) {
  ctx.discordMockServer.registerRoute("GET", `/channels/${channelId}`, {
    status: 200,
    body: {
      id: channelId,
      guild_id: guildId,
      type: 0,
    },
  });

  ctx.discordMockServer.registerRouteForToken(
    "GET",
    "/users/@me/guilds",
    accessToken,
    {
      status: 200,
      body: [
        {
          id: guildId,
          name: "Test Server",
          owner: false,
          permissions: "16",
        },
      ],
    },
  );
}

describe(
  "PATCH /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId",
  { concurrency: true },
  () => {
    describe("Authentication and Authorization", () => {
      it("returns 401 without authentication", async () => {
        const response = await ctx.fetch(
          testUrl(generateTestId(), generateTestId()),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "new-name" }),
          },
        );
        assert.strictEqual(response.status, 401);
      });

      it("returns 404 for non-existent feed", async () => {
        const user = await ctx.asUser(generateSnowflake());

        const response = await user.fetch(
          testUrl(generateTestId(), generateTestId()),
          {
            method: "PATCH",
            body: JSON.stringify({ name: "new-name" }),
          },
        );
        assert.strictEqual(response.status, 404);
      });

      it("returns 404 for feed owned by different user", async () => {
        const otherUser = await ctx.asUser(generateSnowflake());
        const { feedId, connectionId } =
          await createTestFeedWithConnection(ctx);

        const response = await otherUser.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ name: "new-name" }),
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
          method: "PATCH",
          body: JSON.stringify({ name: "new-name" }),
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
            method: "PATCH",
            body: JSON.stringify({ name: "new-name" }),
          },
        );

        assert.strictEqual(response.status, 404);
      });

      it("returns 200 for shared manager with unrestricted connections", async () => {
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
          method: "PATCH",
          body: JSON.stringify({ name: "updated-by-manager" }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { name: string };
        };
        assert.strictEqual(body.result.name, "updated-by-manager");
      });

      it("returns 200 for admin updating another user's feed", async () => {
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
              method: "PATCH",
              body: JSON.stringify({ name: "admin-updated" }),
            },
          );

          assert.strictEqual(response.status, 200);
          const body = (await response.json()) as {
            result: { name: string };
          };
          assert.strictEqual(body.result.name, "admin-updated");
        } finally {
          await adminCtx.teardown();
        }
      });
    });

    describe("Validation", () => {
      it("rejects name longer than 250 characters", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ name: "a".repeat(251) }),
        });
        assert.strictEqual(response.status, 400);
      });

      it("rejects empty name string", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ name: "" }),
        });
        assert.strictEqual(response.status, 400);
      });

      it("rejects forumThreadTitle longer than 100 characters", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ forumThreadTitle: "a".repeat(101) }),
        });
        assert.strictEqual(response.status, 400);
      });

      it("rejects invalid disabledCode value", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ disabledCode: "INVALID" }),
        });
        assert.strictEqual(response.status, 400);
      });

      it("rejects invalid threadCreationMethod value", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ threadCreationMethod: "invalid" }),
        });
        assert.strictEqual(response.status, 400);
      });

      it("rejects componentRows with more than 5 items", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const componentRows = Array.from({ length: 6 }, (_, i) => ({
          id: `row-${i}`,
        }));

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ componentRows }),
        });
        assert.strictEqual(response.status, 400);
      });
    });

    describe("Successful Updates", () => {
      it("updates connection name", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ name: "updated-name" }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as { result: { name: string } };
        assert.strictEqual(body.result.name, "updated-name");
      });

      it("updates content", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ content: "New content {{title}}" }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { details: { content: string } };
        };
        assert.strictEqual(
          body.result.details.content,
          "New content {{title}}",
        );
      });

      it("updates embeds", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            embeds: [{ title: "Test Embed", description: "Test Description" }],
          }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { details: { embeds: Array<{ title: string }> } };
        };
        assert.strictEqual(body.result.details.embeds.length, 1);
        assert.strictEqual(body.result.details.embeds[0]?.title, "Test Embed");
      });

      it("clears detail fields omitted from request", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              details: {
                content: "Old content",
                embeds: [{ title: "Old embed" }],
                forumThreadTitle: "Old thread",
              },
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ name: "name-only" }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );

        assert.strictEqual(storedConnection?.details.content, undefined);
        assert.strictEqual(storedConnection?.details.embeds, undefined);
        assert.strictEqual(
          storedConnection?.details.forumThreadTitle,
          undefined,
        );
      });

      it("updates filters", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            filters: { expression: { type: "CONTAINS", value: "test" } },
          }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { filters: { expression: Record<string, unknown> } };
        };
        assert.ok(body.result.filters);
        assert.deepStrictEqual(body.result.filters.expression, {
          type: "CONTAINS",
          value: "test",
        });
      });

      it("clears filters when set to null", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              filters: { expression: { type: "CONTAINS", value: "old" } },
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ filters: null }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { filters?: unknown };
        };
        assert.strictEqual(body.result.filters, undefined);
      });

      it("updates splitOptions", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            splitOptions: { isEnabled: true, splitChar: "\\n" },
          }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { splitOptions: { isEnabled: boolean; splitChar: string } };
        };
        assert.ok(body.result.splitOptions);
        assert.strictEqual(body.result.splitOptions.isEnabled, true);
        assert.strictEqual(body.result.splitOptions.splitChar, "\\n");
      });

      it("clears splitOptions when set to null", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              splitOptions: { isEnabled: true, splitChar: "," },
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ splitOptions: null }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { splitOptions?: unknown };
        };
        assert.strictEqual(body.result.splitOptions, undefined);
      });

      it("updates mentions", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            mentions: { targets: [{ id: "123", type: "role" }] },
          }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.ok(storedConnection?.mentions);
        assert.strictEqual(storedConnection.mentions.targets?.length, 1);
        assert.strictEqual(storedConnection.mentions.targets?.[0]?.id, "123");
      });

      it("updates formatter options", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            formatter: { formatTables: true, stripImages: true },
          }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(
          storedConnection?.details.formatter?.formatTables,
          true,
        );
        assert.strictEqual(
          storedConnection?.details.formatter?.stripImages,
          true,
        );
      });

      it("updates enablePlaceholderFallback", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ enablePlaceholderFallback: true }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(
          storedConnection?.details.enablePlaceholderFallback,
          true,
        );
      });

      it("updates disabledCode to MANUAL", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ disabledCode: "MANUAL" }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(storedConnection?.disabledCode, "MANUAL");
      });

      it("clears disabledCode when set to null", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "MANUAL",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ disabledCode: null }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(storedConnection?.disabledCode, undefined);
      });

      it("updates forumThreadTitle", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ forumThreadTitle: "New Thread {{title}}" }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(
          storedConnection?.details.forumThreadTitle,
          "New Thread {{title}}",
        );
      });

      it("updates componentRows", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            componentRows: [{ id: "row-1", components: [] }],
          }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(storedConnection?.details.componentRows?.length, 1);
        assert.strictEqual(
          (storedConnection?.details.componentRows?.[0] as { id: string })?.id,
          "row-1",
        );
      });

      it("updates placeholderLimits", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            placeholderLimits: [{ placeholder: "title", characterCount: 100 }],
          }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(
          storedConnection?.details.placeholderLimits?.length,
          1,
        );
        assert.strictEqual(
          storedConnection?.details.placeholderLimits?.[0]?.placeholder,
          "title",
        );
      });

      it("updates customPlaceholders", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            customPlaceholders: [
              {
                id: "cp-1",
                referenceName: "custom",
                sourcePlaceholder: "{{title}}",
                steps: [{ id: "step-1", type: "UPPERCASE" }],
              },
            ],
          }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(storedConnection?.customPlaceholders?.length, 1);
        assert.strictEqual(
          storedConnection?.customPlaceholders?.[0]?.referenceName,
          "custom",
        );
      });

      it("updates rateLimits", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            rateLimits: [{ id: "rl-1", timeWindowSeconds: 60, limit: 10 }],
          }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(storedConnection?.rateLimits?.length, 1);
        assert.strictEqual(
          storedConnection?.rateLimits?.[0]?.timeWindowSeconds,
          60,
        );
        assert.strictEqual(storedConnection?.rateLimits?.[0]?.limit, 10);
      });

      it("clears webhook when switching to channelId", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const guildId = generateSnowflake();
        const newChannelId = generateSnowflake();

        setupDiscordMocks(newChannelId, guildId, user.accessToken.access_token);

        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              details: {
                channel: null,
                webhook: {
                  id: "wh-1",
                  token: "token-1",
                  guildId,
                  isApplicationOwned: true,
                },
              },
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ channelId: newChannelId }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );

        assert.strictEqual(storedConnection?.details.webhook, undefined);
        assert.strictEqual(storedConnection?.details.channel?.id, newChannelId);
      });

      it("accepts content null and componentRows null for V2 mode", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            content: null,
            componentRows: null,
            componentsV2: [
              { type: 17, components: [{ type: 10, content: "{{title}}" }] },
            ],
          }),
        });

        assert.strictEqual(response.status, 200);
      });
    });

    describe("Disabled code re-enabling logic", () => {
      it("returns 400 when trying to enable a BadFormat disabled connection with disabledCode=null", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "BAD_FORMAT",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ disabledCode: null }),
        });

        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(
          body.code,
          "FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED",
        );
      });

      it("auto-enables BadFormat connection when content is updated", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "BAD_FORMAT",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ content: "New valid content {{title}}" }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { disabledCode?: string };
        };
        assert.strictEqual(body.result.disabledCode, undefined);
      });

      it("auto-enables BadFormat connection when embeds are updated", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "BAD_FORMAT",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            embeds: [{ title: "New embed" }],
          }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { disabledCode?: string };
        };
        assert.strictEqual(body.result.disabledCode, undefined);
      });

      it("allows enabling a Manual disabled connection with disabledCode=null", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "MANUAL",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ disabledCode: null }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { disabledCode?: string };
        };
        assert.strictEqual(body.result.disabledCode, undefined);
      });

      it("returns 400 when trying to enable other auto-disabled connection types", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "UNKNOWN",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ disabledCode: null }),
        });

        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(
          body.code,
          "FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED",
        );
      });

      it("keeps BadFormat connection disabled when only name is updated", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "BAD_FORMAT",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ name: "new-name-only" }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { name: string };
        };
        assert.strictEqual(body.result.name, "new-name-only");

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(storedConnection?.disabledCode, "BAD_FORMAT");
      });
    });

    describe("Response format", () => {
      it("returns minimal response structure matching NestJS format", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ name: "minimal-response-test" }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: Record<string, unknown>;
        };

        assert.ok(body.result.id);
        assert.strictEqual(body.result.name, "minimal-response-test");
        assert.strictEqual(body.result.key, "DISCORD_CHANNEL");
        assert.ok(body.result.details);

        assert.strictEqual(
          body.result.mentions,
          undefined,
          "should not include mentions",
        );
        assert.strictEqual(
          body.result.rateLimits,
          undefined,
          "should not include rateLimits",
        );
        assert.strictEqual(
          body.result.customPlaceholders,
          undefined,
          "should not include customPlaceholders",
        );
        assert.strictEqual(
          body.result.disabledCode,
          undefined,
          "should not include disabledCode",
        );
        assert.strictEqual(
          body.result.createdAt,
          undefined,
          "should not include createdAt",
        );
        assert.strictEqual(
          body.result.updatedAt,
          undefined,
          "should not include updatedAt",
        );

        const details = body.result.details as Record<string, unknown>;
        assert.strictEqual(
          details.forumThreadTitle,
          undefined,
          "details should not include forumThreadTitle",
        );
        assert.strictEqual(
          details.forumThreadTags,
          undefined,
          "details should not include forumThreadTags",
        );
        assert.deepStrictEqual(
          details.formatter,
          {},
          "details.formatter should be empty object for connections without formatter",
        );
      });

      it("returns channel with only id and guildId", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ name: "channel-test" }),
        });

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { details: { channel: Record<string, unknown> } };
        };

        const channel = body.result.details.channel;
        assert.ok(channel.id);
        assert.ok(channel.guildId);
        assert.strictEqual(
          channel.type,
          undefined,
          "channel should not include type",
        );
      });
    });

    describe("Embed flattening", () => {
      it("transforms nested embed structure to flat format", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            embeds: [
              {
                title: "Test Title",
                description: "Test Description",
                author: { name: "Author Name", iconUrl: "http://author-icon" },
                footer: { text: "Footer Text", iconUrl: "http://footer-icon" },
                image: { url: "http://image-url" },
                thumbnail: { url: "http://thumbnail-url" },
                fields: [{ name: "Field Name", value: "Field Value" }],
              },
            ],
          }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        const storedEmbed = storedConnection?.details.embeds?.[0] as Record<
          string,
          unknown
        >;

        assert.strictEqual(storedEmbed.title, "Test Title");
        assert.strictEqual(storedEmbed.authorName, "Author Name");
        assert.strictEqual(storedEmbed.authorIconURL, "http://author-icon");
        assert.strictEqual(storedEmbed.footerText, "Footer Text");
        assert.strictEqual(storedEmbed.footerIconURL, "http://footer-icon");
        assert.strictEqual(storedEmbed.imageURL, "http://image-url");
        assert.strictEqual(storedEmbed.thumbnailURL, "http://thumbnail-url");

        assert.strictEqual(
          storedEmbed.author,
          undefined,
          "should not have nested author",
        );
        assert.strictEqual(
          storedEmbed.footer,
          undefined,
          "should not have nested footer",
        );
        assert.strictEqual(
          storedEmbed.image,
          undefined,
          "should not have nested image",
        );
        assert.strictEqual(
          storedEmbed.thumbnail,
          undefined,
          "should not have nested thumbnail",
        );
      });

      it("returns embeds in nested format in response", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          { discordUserId },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({
            embeds: [
              {
                title: "Test Title",
                description: "Test Description",
                author: { name: "Author Name", iconUrl: "http://author-icon" },
                footer: { text: "Footer Text", iconUrl: "http://footer-icon" },
                image: { url: "http://image-url" },
                thumbnail: { url: "http://thumbnail-url" },
              },
            ],
          }),
        });

        assert.strictEqual(response.status, 200);

        const body = (await response.json()) as {
          result: {
            details: {
              embeds: Array<{
                title?: string;
                author?: { name?: string; iconUrl?: string };
                footer?: { text?: string; iconUrl?: string };
                image?: { url?: string };
                thumbnail?: { url?: string };
              }>;
            };
          };
        };

        const responseEmbed = body.result.details.embeds[0];
        assert.ok(responseEmbed);
        assert.strictEqual(responseEmbed.title, "Test Title");
        assert.deepStrictEqual(responseEmbed.author, {
          name: "Author Name",
          iconUrl: "http://author-icon",
        });
        assert.deepStrictEqual(responseEmbed.footer, {
          text: "Footer Text",
          iconUrl: "http://footer-icon",
        });
        assert.deepStrictEqual(responseEmbed.image, {
          url: "http://image-url",
        });
        assert.deepStrictEqual(responseEmbed.thumbnail, {
          url: "http://thumbnail-url",
        });
      });
    });

    describe("Auto-enable with empty content/embeds", () => {
      it("does NOT auto-enable BadFormat connection with empty content string", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "BAD_FORMAT",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ content: "" }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(
          storedConnection?.disabledCode,
          "BAD_FORMAT",
          "should remain disabled with BAD_FORMAT",
        );
      });

      it("does NOT auto-enable BadFormat connection with empty embeds array", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "BAD_FORMAT",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ embeds: [] }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(
          storedConnection?.disabledCode,
          "BAD_FORMAT",
          "should remain disabled with BAD_FORMAT",
        );
      });

      it("auto-enables BadFormat connection with non-empty content", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "BAD_FORMAT",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ content: "Valid content" }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(
          storedConnection?.disabledCode,
          undefined,
          "should be enabled",
        );
      });

      it("auto-enables BadFormat connection with non-empty embeds array", async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);
        const { feedId, connectionId } = await createTestFeedWithConnection(
          ctx,
          {
            discordUserId,
            connectionOverrides: {
              disabledCode: "BAD_FORMAT",
            },
          },
        );

        const response = await user.fetch(testUrl(feedId, connectionId), {
          method: "PATCH",
          body: JSON.stringify({ embeds: [{ title: "Valid embed" }] }),
        });

        assert.strictEqual(response.status, 200);

        const feed = await ctx.container.userFeedRepository.findById(feedId);
        const storedConnection = feed?.connections.discordChannels.find(
          (c) => c.id === connectionId,
        );
        assert.strictEqual(
          storedConnection?.disabledCode,
          undefined,
          "should be enabled",
        );
      });
    });
  },
);
