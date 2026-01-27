import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";

function assertMatchesObject(actual: Record<string, unknown>, expected: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(expected)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      assert.ok(actual[key] !== undefined, `Expected property "${key}" to exist`);
      assertMatchesObject(actual[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      assert.deepStrictEqual(actual[key], value, `Expected property "${key}" to match`);
    }
  }
}
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import type { IUserFeed } from "../../src/repositories/interfaces/user-feed.types";
import type { IDiscordChannelConnection } from "../../src/repositories/interfaces/feed-connection.types";
import {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordComponentType,
  FeedConnectionDiscordComponentButtonStyle,
  FeedConnectionMentionType,
  CustomPlaceholderStepType,
} from "../../src/repositories/shared/enums";
import { CopyableSetting } from "../../src/services/feed-connections-discord-channels/types";
import {
  MissingDiscordChannelException,
  DiscordChannelPermissionsException,
  InvalidFilterExpressionException,
} from "../../src/shared/exceptions/feed-connections.exceptions";
import { DiscordAPIError } from "../../src/shared/exceptions/discord-api.error";

function objectId(): string {
  return new Types.ObjectId().toHexString();
}

function randomUUID(): string {
  return crypto.randomUUID();
}

interface TestFeedOptions {
  discordUserId?: string;
  connections?: {
    discordChannels?: Array<{
      id?: string;
      name?: string;
      disabledCode?: FeedConnectionDisabledCode;
      filters?: { expression: Record<string, unknown> };
      rateLimits?: Array<{ id: string; timeWindowSeconds: number; limit: number }>;
      splitOptions?: { splitChar?: string; appendChar?: string; prependChar?: string };
      mentions?: { targets?: Array<{ id: string; type: FeedConnectionMentionType; filters?: { expression: Record<string, unknown> } }> };
      details?: {
        channel?: { id: string; guildId: string };
        webhook?: {
          id: string;
          channel?: string;
          guildId: string;
          token: string;
          iconUrl?: string;
          name?: string;
          isApplicationOwned?: boolean;
          threadId?: string;
        };
        embeds?: Array<Record<string, unknown>>;
        content?: string;
        formatter?: { formatTables?: boolean; stripImages?: boolean; disableImageLinkPreviews?: boolean };
        componentRows?: Array<{ id: string; components: Array<Record<string, unknown>> }>;
        enablePlaceholderFallback?: boolean;
        forumThreadTags?: Array<{ id: string; filters?: { expression: Record<string, unknown> } }>;
        forumThreadTitle?: string;
        placeholderLimits?: Array<{ characterCount: number; placeholder: string; appendString?: string }>;
      };
    }>;
  };
}

async function createFeed(
  ctx: AppTestContext,
  options: TestFeedOptions = {}
): Promise<IUserFeed> {
  const discordUserId = options.discordUserId ?? objectId();

  const feedData: Parameters<typeof ctx.container.userFeedRepository.create>[0] = {
    title: "Test Feed",
    url: `https://example.com/feed/${objectId()}`,
    user: { discordUserId },
  };

  const feed = await ctx.container.userFeedRepository.create(feedData);

  if (options.connections?.discordChannels?.length) {
    for (const conn of options.connections.discordChannels) {
      const connectionId = conn.id ?? objectId();
      await ctx.container.userFeedRepository.updateById(feed.id, {
        $push: {
          "connections.discordChannels": {
            id: new Types.ObjectId(connectionId),
            name: conn.name ?? "connection-name",
            disabledCode: conn.disabledCode,
            filters: conn.filters,
            rateLimits: conn.rateLimits,
            splitOptions: conn.splitOptions,
            mentions: conn.mentions,
            details: {
              channel: conn.details?.channel,
              webhook: conn.details?.webhook,
              embeds: conn.details?.embeds ?? [],
              content: conn.details?.content,
              formatter: conn.details?.formatter ?? { formatTables: false, stripImages: false },
              componentRows: conn.details?.componentRows,
              enablePlaceholderFallback: conn.details?.enablePlaceholderFallback,
              forumThreadTags: conn.details?.forumThreadTags,
              forumThreadTitle: conn.details?.forumThreadTitle,
              placeholderLimits: conn.details?.placeholderLimits,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });
    }

    return (await ctx.container.userFeedRepository.findById(feed.id))!;
  }

  return feed;
}

async function getFeed(ctx: AppTestContext, id: string): Promise<IUserFeed | null> {
  return ctx.container.userFeedRepository.findById(id);
}

describe("FeedConnectionsDiscordChannelsService Integration", { concurrency: true }, () => {
  let ctx: AppTestContext;
  let mockFeedsService: {
    canUseChannel: ReturnType<typeof mock.fn>;
  };
  let mockFeedHandlerService: {
    validateFilters: ReturnType<typeof mock.fn>;
  };
  let mockSupportersService: {
    getBenefitsOfDiscordUser: ReturnType<typeof mock.fn>;
  };

  before(async () => {
    ctx = await createAppTestContext();

    mockFeedsService = {
      canUseChannel: mock.fn(() => Promise.resolve({ guild_id: "guild-id" })),
    };
    mockFeedHandlerService = {
      validateFilters: mock.fn(() => Promise.resolve({ errors: [] })),
    };
    mockSupportersService = {
      getBenefitsOfDiscordUser: mock.fn(() =>
        Promise.resolve({ allowCustomPlaceholders: true })
      ),
    };

    (ctx.container.feedsService as any).canUseChannel = mockFeedsService.canUseChannel;
    (ctx.container.feedHandlerService as any).validateFilters = mockFeedHandlerService.validateFilters;
    (ctx.container.supportersService as any).getBenefitsOfDiscordUser = mockSupportersService.getBenefitsOfDiscordUser;
  });

  after(async () => {
    await ctx.teardown();
  });

  beforeEach(() => {
    mockFeedsService.canUseChannel.mock.resetCalls();
    mockFeedHandlerService.validateFilters.mock.resetCalls();
    mockSupportersService.getBenefitsOfDiscordUser.mock.resetCalls();

    mockFeedsService.canUseChannel.mock.mockImplementation(() =>
      Promise.resolve({ guild_id: "guild-id" })
    );
    mockFeedHandlerService.validateFilters.mock.mockImplementation(() =>
      Promise.resolve({ errors: [] })
    );
    mockSupportersService.getBenefitsOfDiscordUser.mock.mockImplementation(() =>
      Promise.resolve({ allowCustomPlaceholders: true })
    );
  });

  describe("createDiscordChannelConnection", { concurrency: true }, () => {
    const guildId = "guild-id";
    const channelId = "channel-id";

    it("saves the new connection", async () => {
      const createdFeed = await createFeed(ctx);

      mockFeedsService.canUseChannel.mock.mockImplementation(() =>
        Promise.resolve({ guild_id: guildId })
      );

      const creationDetails = {
        feed: createdFeed,
        name: "name",
        channelId,
        userAccessToken: "user-access-token",
        guildId: guildId,
        userDiscordUserId: "user-id",
      };

      await ctx.container.feedConnectionsDiscordChannelsService.createDiscordChannelConnection(
        creationDetails
      );

      const updatedFeed = await getFeed(ctx, createdFeed.id);

      assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);

      const connection = updatedFeed?.connections.discordChannels[0];
      assert.ok(connection);
      assert.ok(connection.id);
      assert.strictEqual(connection.name, creationDetails.name);
      assert.ok(connection.createdAt instanceof Date);
      assert.ok(connection.updatedAt instanceof Date);
      assert.strictEqual(connection.details.channel?.id, creationDetails.channelId);
      assert.strictEqual(connection.details.channel?.guildId, guildId);
      assert.deepStrictEqual(connection.details.embeds, []);
      assert.strictEqual(connection.details.formatter.formatTables, false);
      assert.strictEqual(connection.details.formatter.stripImages, false);
    });
  });

  describe("cloneConnection", { concurrency: true }, () => {
    it("clones the connection and returns the new id", async () => {
      const guildId = "guild-id";
      const connectionIdToUse = objectId();

      const connection: IDiscordChannelConnection = {
        id: connectionIdToUse,
        name: "name",
        createdAt: new Date(),
        updatedAt: new Date(),
        disabledCode: FeedConnectionDisabledCode.BadFormat,
        filters: {
          expression: {
            foo: "bar",
          },
        },
        splitOptions: {
          splitChar: "1",
          appendChar: "2",
          prependChar: "3",
        },
        details: {
          channel: {
            id: "channel-id",
            guildId,
          },
          embeds: [],
          content: "content",
          formatter: {
            formatTables: true,
            stripImages: true,
          },
        },
      };

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: connection.name,
              disabledCode: connection.disabledCode,
              filters: connection.filters,
              splitOptions: connection.splitOptions,
              details: {
                channel: connection.details.channel,
                embeds: connection.details.embeds,
                content: connection.details.content,
                formatter: connection.details.formatter,
              },
            },
          ],
        },
      });

      const { ids } = await ctx.container.feedConnectionsDiscordChannelsService.cloneConnection(
        connection,
        {
          name: connection.name + "new-name",
          targetFeedIds: [createdFeed.id],
        },
        "token",
        "user-id"
      );

      const clonedConnectionId = ids[0];
      const updatedFeed = await getFeed(ctx, createdFeed.id);

      assert.strictEqual(updatedFeed?.connections.discordChannels.length, 2);

      const clonedConnection = updatedFeed?.connections.discordChannels.find(
        (c) => c.id === clonedConnectionId
      );

      assert.ok(clonedConnection);
      assert.strictEqual(clonedConnection.name, connection.name + "new-name");
      assert.ok(clonedConnection.createdAt instanceof Date);
      assert.ok(clonedConnection.updatedAt instanceof Date);
      assert.strictEqual(clonedConnection.disabledCode, connection.disabledCode);
      assertMatchesObject(clonedConnection.filters as Record<string, unknown>, connection.filters as Record<string, unknown>);
      assertMatchesObject(clonedConnection.splitOptions as Record<string, unknown>, connection.splitOptions as Record<string, unknown>);
      assertMatchesObject(clonedConnection.details.channel as Record<string, unknown>, connection.details.channel as Record<string, unknown>);
      assert.strictEqual(clonedConnection.details.content, connection.details.content);
    });
  });

  describe("updateDiscordChannelConnection", { concurrency: true }, () => {
    const guildId = "guild-id";

    it("updates the connection", async () => {
      const connectionIdToUse = objectId();

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              disabledCode: FeedConnectionDisabledCode.BadFormat,
              filters: { expression: { foo: "bar" } },
              splitOptions: { splitChar: "1", appendChar: "2", prependChar: "3" },
              details: {
                channel: { id: "channel-id", guildId },
                embeds: [{ author: { name: "hi" } }],
              },
            },
          ],
        },
      });

      mockFeedsService.canUseChannel.mock.mockImplementation(() =>
        Promise.resolve({ guild_id: guildId })
      );

      const oldConnection = createdFeed.connections.discordChannels[0];
      const customPlaceholderId = randomUUID();
      const customPlaceholderStepId = randomUUID();

      const updateInput = {
        accessToken: "access-token",
        oldConnection,
        feed: {
          user: { discordUserId: "user-id" },
          connections: createdFeed.connections,
        },
        updates: {
          name: "updatedName",
          filters: { expression: { foo: "bar" } },
          customPlaceholders: [
            {
              id: customPlaceholderId,
              referenceName: "refe",
              sourcePlaceholder: "title",
              steps: [
                {
                  id: customPlaceholderStepId,
                  regexSearch: "regex-search",
                  replacementString: "replacement",
                  type: CustomPlaceholderStepType.Regex,
                },
              ],
            },
          ],
          splitOptions: { splitChar: "s", appendChar: "a" },
          details: {
            channel: { id: "updatedChannelId" },
            channelNewThreadExcludesPreview: false,
            channelNewThreadTitle: "",
            content: "updatedContent",
            embeds: [
              {
                title: "updatedTitle",
                description: "updatedDescription",
                url: "updatedUrl",
                color: "123",
              },
            ],
            componentRows: [
              {
                id: "row1",
                components: [
                  {
                    type: FeedConnectionDiscordComponentType.Button,
                    label: "label",
                    url: "url",
                    style: FeedConnectionDiscordComponentButtonStyle.Link,
                  },
                ],
              },
            ],
          },
        },
      };

      await ctx.container.feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
        createdFeed.id,
        connectionIdToUse,
        updateInput
      );

      const updatedFeed = await getFeed(ctx, createdFeed.id);

      assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);

      const updatedConnection = updatedFeed?.connections.discordChannels[0];
      assert.ok(updatedConnection);
      assert.strictEqual(updatedConnection.id, connectionIdToUse);
      assert.strictEqual(updatedConnection.name, updateInput.updates.name);
      assertMatchesObject(updatedConnection.filters as Record<string, unknown>, updateInput.updates.filters as Record<string, unknown>);
      assert.strictEqual(updatedConnection.customPlaceholders?.length, 1);
      assert.strictEqual(updatedConnection.customPlaceholders?.[0].id, customPlaceholderId);
      assert.strictEqual(updatedConnection.customPlaceholders?.[0].referenceName, "refe");
      assert.strictEqual(updatedConnection.customPlaceholders?.[0].sourcePlaceholder, "title");
      assert.strictEqual(updatedConnection.customPlaceholders?.[0].steps?.[0].id, customPlaceholderStepId);
      assertMatchesObject(updatedConnection.details.embeds as unknown as Record<string, unknown>[], updateInput.updates.details?.embeds as unknown as Record<string, unknown>[]);
      assert.strictEqual(updatedConnection.details.channel?.id, updateInput.updates.details?.channel?.id);
      assert.strictEqual(updatedConnection.details.channel?.guildId, guildId);
      assert.strictEqual(updatedConnection.details.content, updateInput.updates.details?.content);
      assertMatchesObject(updatedConnection.details.componentRows as unknown as Record<string, unknown>[], updateInput.updates.details?.componentRows as unknown as Record<string, unknown>[]);
    });

    it("updates disabled code", async () => {
      const connectionIdToUse = objectId();

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: { channel: { id: "channel-id", guildId } },
            },
          ],
        },
      });

      const oldConnection = createdFeed.connections.discordChannels[0];

      await ctx.container.feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
        createdFeed.id,
        connectionIdToUse,
        {
          accessToken: "access-token",
          feed: createdFeed,
          oldConnection,
          updates: {
            disabledCode: FeedConnectionDisabledCode.BadFormat,
          },
        }
      );

      const updatedFeed = await getFeed(ctx, createdFeed.id);

      assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);
      assert.strictEqual(
        updatedFeed?.connections.discordChannels[0].disabledCode,
        FeedConnectionDisabledCode.BadFormat
      );
    });

    it("updates split options", async () => {
      const connectionIdToUse = objectId();

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: { channel: { id: "channel-id", guildId } },
            },
          ],
        },
      });

      const oldConnection = createdFeed.connections.discordChannels[0];
      const splitOptions = { splitChar: "s", appendChar: "a" };

      await ctx.container.feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
        createdFeed.id,
        connectionIdToUse,
        {
          accessToken: "access-token",
          oldConnection,
          feed: createdFeed,
          updates: { splitOptions },
        }
      );

      const updatedFeed = await getFeed(ctx, createdFeed.id);

      assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);
      assertMatchesObject(
        updatedFeed?.connections.discordChannels[0].splitOptions as Record<string, unknown>,
        splitOptions as Record<string, unknown>
      );
    });

    it("allows nullable properties to be cleared", async () => {
      const connectionIdToUse = objectId();

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              disabledCode: FeedConnectionDisabledCode.BadFormat,
              filters: { expression: { foo: "bar" } },
              splitOptions: { splitChar: "1", appendChar: "2", prependChar: "3" },
              details: { channel: { id: "channel-id", guildId } },
            },
          ],
        },
      });

      const oldConnection = createdFeed.connections.discordChannels[0];

      await ctx.container.feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
        createdFeed.id,
        connectionIdToUse,
        {
          accessToken: "access-token",
          oldConnection,
          feed: createdFeed,
          updates: {
            filters: null,
            disabledCode: null,
            splitOptions: null,
          },
        }
      );

      const updatedFeed = await getFeed(ctx, createdFeed.id);

      assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);
      assert.strictEqual(updatedFeed?.connections.discordChannels[0].filters, undefined);
      assert.strictEqual(updatedFeed?.connections.discordChannels[0].disabledCode, undefined);
      assert.strictEqual(updatedFeed?.connections.discordChannels[0].splitOptions, undefined);
    });

    it("throws if channel does not exist", async () => {
      const connectionIdToUse = objectId();

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: { channel: { id: "channel-id", guildId } },
            },
          ],
        },
      });

      mockFeedsService.canUseChannel.mock.mockImplementation(() => {
        throw new DiscordAPIError("Not found", 404);
      });

      const oldConnection = createdFeed.connections.discordChannels[0];

      await assert.rejects(
        () =>
          ctx.container.feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
            createdFeed.id,
            connectionIdToUse,
            {
              accessToken: "access-token",
              feed: createdFeed,
              oldConnection,
              updates: {
                details: { channel: { id: "updatedChannelId" } },
              },
            }
          ),
        MissingDiscordChannelException
      );
    });

    it("throws if bot does not have access to channel", async () => {
      const connectionIdToUse = objectId();

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: { channel: { id: "channel-id", guildId } },
            },
          ],
        },
      });

      mockFeedsService.canUseChannel.mock.mockImplementation(() => {
        throw new DiscordAPIError("Forbidden", 403);
      });

      const oldConnection = createdFeed.connections.discordChannels[0];

      await assert.rejects(
        () =>
          ctx.container.feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
            createdFeed.id,
            connectionIdToUse,
            {
              accessToken: "access-token",
              feed: createdFeed,
              oldConnection,
              updates: {
                details: { channel: { id: "updatedChannelId" } },
              },
            }
          ),
        DiscordChannelPermissionsException
      );
    });

    it("throws on invalid filters", async () => {
      const connectionIdToUse = objectId();

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: { channel: { id: "channel-id", guildId } },
            },
          ],
        },
      });

      mockFeedHandlerService.validateFilters.mock.mockImplementation(() =>
        Promise.resolve({ errors: ["1", "2"] })
      );

      const oldConnection = createdFeed.connections.discordChannels[0];

      await assert.rejects(
        () =>
          ctx.container.feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
            createdFeed.id,
            connectionIdToUse,
            {
              accessToken: "access-token",
              oldConnection,
              feed: createdFeed,
              updates: {
                filters: {
                  expression: { foo: "bar", baz: "qux" },
                },
              },
            }
          ),
        InvalidFilterExpressionException
      );
    });
  });

  describe("copySettings", { concurrency: true }, () => {
    it("copies settings correctly", async () => {
      const guildId = "guild-id";
      const sourceConnectionId = objectId();
      const targetConnectionId1 = objectId();
      const targetConnectionId2 = objectId();

      const sourceConnection = {
        id: sourceConnectionId,
        name: "source",
        disabledCode: FeedConnectionDisabledCode.BadFormat,
        filters: { expression: { foo: "bar" } },
        rateLimits: [{ id: "1", timeWindowSeconds: 100, limit: 10 }],
        splitOptions: { splitChar: "1", appendChar: "2", prependChar: "3" },
        mentions: {
          targets: [
            {
              id: "1",
              type: FeedConnectionMentionType.Role,
              filters: { expression: { foo: "bar" } },
            },
          ],
        },
        details: {
          webhook: {
            id: "webhook-id-1",
            channel: "channel-id",
            guildId: "guild-id",
            token: "token",
            iconUrl: "icon-url",
            name: "name",
            isApplicationOwned: true,
            threadId: "thread-id",
          },
          embeds: [{ authorName: "auth name", authorURL: "auth url", fields: [] }],
          formatter: {
            disableImageLinkPreviews: true,
            formatTables: true,
            stripImages: true,
          },
          componentRows: [
            {
              id: "1",
              components: [
                {
                  id: "1",
                  label: "label",
                  style: 5,
                  type: FeedConnectionDiscordComponentType.Button,
                  url: "url",
                },
              ],
            },
          ],
          content: "content",
          enablePlaceholderFallback: true,
          forumThreadTags: [{ id: "1", filters: { expression: { hello: "world" } } }],
          forumThreadTitle: "forum-thread-title",
          placeholderLimits: [
            { characterCount: 100, placeholder: "placeholder", appendString: "append-string" },
          ],
        },
      };

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            sourceConnection,
            {
              id: targetConnectionId1,
              name: "target1",
              details: {
                channel: { id: "channel-id2", guildId },
                webhook: {
                  id: "webhook-id-2",
                  channel: "channel-id",
                  guildId: "guild-id",
                  token: "token",
                  iconUrl: "icon-url2",
                  name: "name2",
                  isApplicationOwned: true,
                },
              },
            },
            {
              id: targetConnectionId2,
              name: "target2",
              filters: { expression: { foo: "bar" } },
              splitOptions: { splitChar: "1", appendChar: "2", prependChar: "3" },
              details: {
                channel: { id: "channel-id3", guildId },
                webhook: {
                  id: "webhook-id-3",
                  channel: "channel-id",
                  guildId: "guild-id",
                  token: "token",
                  iconUrl: "icon-url3",
                  name: "name3",
                  isApplicationOwned: true,
                },
              },
            },
          ],
        },
      });

      const feedAfterCreate = await getFeed(ctx, createdFeed.id);
      const sourceConn = feedAfterCreate!.connections.discordChannels.find(
        (c) => c.id === sourceConnectionId
      )!;

      await ctx.container.feedConnectionsDiscordChannelsService.copySettings(
        feedAfterCreate!,
        sourceConn,
        {
          properties: Object.values(CopyableSetting),
          targetDiscordChannelConnectionIds: [targetConnectionId1, targetConnectionId2],
        }
      );

      const updatedFeed = await getFeed(ctx, createdFeed.id);

      assert.strictEqual(updatedFeed?.connections.discordChannels.length, 3);

      const targetConnections = updatedFeed?.connections.discordChannels.filter(
        (c) => c.id === targetConnectionId1 || c.id === targetConnectionId2
      );

      assert.strictEqual(targetConnections?.length, 2);

      for (const c of targetConnections!) {
        assertMatchesObject(c.filters as Record<string, unknown>, sourceConnection.filters as Record<string, unknown>);
        assertMatchesObject(c.splitOptions as Record<string, unknown>, sourceConnection.splitOptions as Record<string, unknown>);
        assertMatchesObject(c.rateLimits as unknown as Record<string, unknown>, sourceConnection.rateLimits as unknown as Record<string, unknown>);
        assertMatchesObject(c.mentions as unknown as Record<string, unknown>, sourceConnection.mentions as unknown as Record<string, unknown>);
        assertMatchesObject(c.details.embeds as unknown as Record<string, unknown>, sourceConnection.details.embeds as unknown as Record<string, unknown>);
        assertMatchesObject(c.details.formatter as unknown as Record<string, unknown>, sourceConnection.details.formatter as unknown as Record<string, unknown>);
        assert.strictEqual(c.details.content, sourceConnection.details.content);
        assertMatchesObject(c.details.componentRows as unknown as Record<string, unknown>, sourceConnection.details.componentRows as unknown as Record<string, unknown>);
        assert.strictEqual(
          c.details.enablePlaceholderFallback,
          sourceConnection.details.enablePlaceholderFallback
        );
        assertMatchesObject(c.details.forumThreadTags as unknown as Record<string, unknown>, sourceConnection.details.forumThreadTags as unknown as Record<string, unknown>);
        assert.strictEqual(c.details.forumThreadTitle, sourceConnection.details.forumThreadTitle);
        assertMatchesObject(c.details.placeholderLimits as unknown as Record<string, unknown>, sourceConnection.details.placeholderLimits as unknown as Record<string, unknown>);
        assert.strictEqual(c.details.webhook?.iconUrl, sourceConnection.details.webhook?.iconUrl);
        assert.strictEqual(c.details.webhook?.name, sourceConnection.details.webhook?.name);
        assert.strictEqual(c.details.webhook?.threadId, sourceConnection.details.webhook?.threadId);
      }
    });
  });

  describe("deleteConnection", { concurrency: true }, () => {
    it("removes the discord channel connection by id", async () => {
      const connectionIdToUse = objectId();

      const createdFeed = await createFeed(ctx, {
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: {
                channel: { id: "channel-id", guildId: "guild-id" },
              },
            },
          ],
        },
      });

      await ctx.container.feedConnectionsDiscordChannelsService.deleteConnection(
        createdFeed.id,
        connectionIdToUse
      );

      const updatedFeed = await getFeed(ctx, createdFeed.id);

      assert.strictEqual(updatedFeed?.connections.discordChannels.length, 0);
    });
  });
});
