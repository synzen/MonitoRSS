import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";

function assertMatchesObject<T extends object>(actual: T, expected: T): void {
  for (const [key, value] of Object.entries(expected)) {
    const actualValue = (actual as Record<string, unknown>)[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      assert.ok(
        actualValue !== undefined,
        `Expected property "${key}" to exist`,
      );
      assertMatchesObject(
        actualValue as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      assert.deepStrictEqual(
        actualValue,
        value,
        `Expected property "${key}" to match`,
      );
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
import {
  CopyableSetting,
  UserFeedTargetFeedSelectionType,
} from "../../src/services/feed-connections-discord-channels/types";
import {
  MissingDiscordChannelException,
  DiscordChannelPermissionsException,
  InvalidFilterExpressionException,
} from "../../src/shared/exceptions/feed-connections.exceptions";
import { DiscordAPIError } from "../../src/shared/exceptions/discord-api.error";
import { TestDeliveryStatus } from "../../src/services/feed-handler/types";

function objectId(): string {
  return new Types.ObjectId().toHexString();
}

function randomUUID(): string {
  return crypto.randomUUID();
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

interface TestFeedOptions {
  discordUserId?: string;
  connections?: {
    discordChannels?: Array<DeepPartial<IDiscordChannelConnection>>;
  };
}

async function createFeed(
  ctx: AppTestContext,
  options: TestFeedOptions = {},
): Promise<IUserFeed> {
  const discordUserId = options.discordUserId ?? objectId();

  const feedData: Parameters<
    typeof ctx.container.userFeedRepository.create
  >[0] = {
    title: "Test Feed",
    url: `https://example.com/feed/${objectId()}`,
    user: { id: discordUserId, discordUserId },
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
              formatter: conn.details?.formatter ?? {
                formatTables: false,
                stripImages: false,
              },
              componentRows: conn.details?.componentRows,
              enablePlaceholderFallback:
                conn.details?.enablePlaceholderFallback,
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

async function getFeed(
  ctx: AppTestContext,
  id: string,
): Promise<IUserFeed | null> {
  return ctx.container.userFeedRepository.findById(id);
}

describe(
  "FeedConnectionsDiscordChannelsService Integration",
  { concurrency: false },
  () => {
    let ctx: AppTestContext;
    let mockFeedsService: {
      canUseChannel: ReturnType<typeof mock.fn>;
    };
    let mockFeedHandlerService: {
      validateFilters: ReturnType<typeof mock.fn>;
      sendTestArticle: ReturnType<typeof mock.fn>;
    };
    let mockSupportersService: {
      getBenefitsOfDiscordUser: ReturnType<typeof mock.fn>;
    };
    let mockUsersService: {
      getOrCreateUserByDiscordId: ReturnType<typeof mock.fn>;
    };

    before(async () => {
      ctx = await createAppTestContext();

      mockFeedsService = {
        canUseChannel: mock.fn(() => Promise.resolve({ guild_id: "guild-id" })),
      };
      mockFeedHandlerService = {
        validateFilters: mock.fn(() => Promise.resolve({ errors: [] })),
        sendTestArticle: mock.fn(() =>
          Promise.resolve({ status: TestDeliveryStatus.Success }),
        ),
      };
      mockSupportersService = {
        getBenefitsOfDiscordUser: mock.fn(() =>
          Promise.resolve({ allowCustomPlaceholders: true }),
        ),
      };
      mockUsersService = {
        getOrCreateUserByDiscordId: mock.fn(() =>
          Promise.resolve({ preferences: {} }),
        ),
      };

      (ctx.container.feedsService as any).canUseChannel =
        mockFeedsService.canUseChannel;
      (ctx.container.feedHandlerService as any).validateFilters =
        mockFeedHandlerService.validateFilters;
      (ctx.container.feedHandlerService as any).sendTestArticle =
        mockFeedHandlerService.sendTestArticle;
      (ctx.container.supportersService as any).getBenefitsOfDiscordUser =
        mockSupportersService.getBenefitsOfDiscordUser;
      (ctx.container.usersService as any).getOrCreateUserByDiscordId =
        mockUsersService.getOrCreateUserByDiscordId;
    });

    after(async () => {
      await ctx.teardown();
    });

    beforeEach(() => {
      mockFeedsService.canUseChannel.mock.resetCalls();
      mockFeedHandlerService.validateFilters.mock.resetCalls();
      mockFeedHandlerService.sendTestArticle.mock.resetCalls();
      mockSupportersService.getBenefitsOfDiscordUser.mock.resetCalls();
      mockUsersService.getOrCreateUserByDiscordId.mock.resetCalls();

      mockFeedsService.canUseChannel.mock.mockImplementation(() =>
        Promise.resolve({ guild_id: "guild-id" }),
      );
      mockFeedHandlerService.validateFilters.mock.mockImplementation(() =>
        Promise.resolve({ errors: [] }),
      );
      mockFeedHandlerService.sendTestArticle.mock.mockImplementation(() =>
        Promise.resolve({ status: TestDeliveryStatus.Success }),
      );
      mockSupportersService.getBenefitsOfDiscordUser.mock.mockImplementation(
        () => Promise.resolve({ allowCustomPlaceholders: true }),
      );
      mockUsersService.getOrCreateUserByDiscordId.mock.mockImplementation(() =>
        Promise.resolve({ preferences: {} }),
      );
    });

    describe("createDiscordChannelConnection", { concurrency: false }, () => {
      const guildId = "guild-id";
      const channelId = "channel-id";

      it("saves the new connection", async () => {
        const createdFeed = await createFeed(ctx);

        mockFeedsService.canUseChannel.mock.mockImplementation(() =>
          Promise.resolve({ guild_id: guildId }),
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
          creationDetails,
        );

        const updatedFeed = await getFeed(ctx, createdFeed.id);

        assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);

        const connection = updatedFeed?.connections.discordChannels[0];
        assert.ok(connection);
        assert.ok(connection.id);
        assert.strictEqual(connection.name, creationDetails.name);
        assert.ok(connection.createdAt instanceof Date);
        assert.ok(connection.updatedAt instanceof Date);
        assert.strictEqual(
          connection.details.channel?.id,
          creationDetails.channelId,
        );
        assert.strictEqual(connection.details.channel?.guildId, guildId);
        assert.deepStrictEqual(connection.details.embeds, []);
        assert.strictEqual(connection.details.formatter.formatTables, false);
        assert.strictEqual(connection.details.formatter.stripImages, false);
      });
    });

    describe("cloneConnection", { concurrency: false }, () => {
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

        const { ids } =
          await ctx.container.feedConnectionsDiscordChannelsService.cloneConnection(
            connection,
            {
              name: connection.name + "new-name",
              targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
              targetFeedIds: [createdFeed.id],
            },
            "token",
            "user-id",
          );

        const clonedConnectionId = ids[0];
        const updatedFeed = await getFeed(ctx, createdFeed.id);

        assert.strictEqual(updatedFeed?.connections.discordChannels.length, 2);

        const clonedConnection = updatedFeed?.connections.discordChannels.find(
          (c) => c.id === clonedConnectionId,
        );

        assert.ok(clonedConnection);
        assert.strictEqual(clonedConnection.name, connection.name + "new-name");
        assert.ok(clonedConnection.createdAt instanceof Date);
        assert.ok(clonedConnection.updatedAt instanceof Date);
        assert.strictEqual(
          clonedConnection.disabledCode,
          connection.disabledCode,
        );
        assertMatchesObject(clonedConnection.filters!, connection.filters!);
        assertMatchesObject(
          clonedConnection.splitOptions!,
          connection.splitOptions!,
        );
        assertMatchesObject(
          clonedConnection.details.channel!,
          connection.details.channel!,
        );
        assert.strictEqual(
          clonedConnection.details.content,
          connection.details.content,
        );
      });

      it("clones connection to multiple target feeds", async () => {
        const guildId = "guild-id";
        const connectionIdToUse = objectId();
        const discordUserId = objectId();

        const connection: IDiscordChannelConnection = {
          id: connectionIdToUse,
          name: "source-connection",
          createdAt: new Date(),
          updatedAt: new Date(),
          details: {
            channel: { id: "channel-id", guildId },
            embeds: [],
            content: "test content",
            formatter: { formatTables: false, stripImages: false },
          },
        };

        const feed1 = await createFeed(ctx, {
          discordUserId,
          connections: {
            discordChannels: [
              {
                id: connectionIdToUse,
                name: connection.name,
                details: connection.details,
              },
            ],
          },
        });
        const feed2 = await createFeed(ctx, { discordUserId });
        const feed3 = await createFeed(ctx, { discordUserId });

        const { ids } =
          await ctx.container.feedConnectionsDiscordChannelsService.cloneConnection(
            connection,
            {
              name: "cloned-connection",
              targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
              targetFeedIds: [feed1.id, feed2.id, feed3.id],
            },
            "token",
            discordUserId,
          );

        assert.strictEqual(ids.length, 3);

        const updatedFeed1 = await getFeed(ctx, feed1.id);
        const updatedFeed2 = await getFeed(ctx, feed2.id);
        const updatedFeed3 = await getFeed(ctx, feed3.id);

        assert.strictEqual(updatedFeed1?.connections.discordChannels.length, 2);
        assert.strictEqual(updatedFeed2?.connections.discordChannels.length, 1);
        assert.strictEqual(updatedFeed3?.connections.discordChannels.length, 1);

        for (const feed of [updatedFeed1, updatedFeed2, updatedFeed3]) {
          const clonedConn = feed?.connections.discordChannels.find(
            (c) => c.name === "cloned-connection",
          );
          assert.ok(clonedConn);
          assert.strictEqual(clonedConn.details.content, "test content");
        }
      });

      it("clones connection with new channel id", async () => {
        const guildId = "guild-id";
        const newGuildId = "new-guild-id";
        const connectionIdToUse = objectId();
        const newChannelId = "new-channel-id";

        mockFeedsService.canUseChannel.mock.mockImplementation(() =>
          Promise.resolve({ guild_id: newGuildId }),
        );

        const connection: IDiscordChannelConnection = {
          id: connectionIdToUse,
          name: "source-connection",
          createdAt: new Date(),
          updatedAt: new Date(),
          details: {
            channel: { id: "original-channel-id", guildId },
            embeds: [],
            content: "test content",
            formatter: { formatTables: false, stripImages: false },
          },
        };

        const createdFeed = await createFeed(ctx, {
          connections: {
            discordChannels: [
              {
                id: connectionIdToUse,
                name: connection.name,
                details: connection.details,
              },
            ],
          },
        });

        const { ids } =
          await ctx.container.feedConnectionsDiscordChannelsService.cloneConnection(
            connection,
            {
              name: "cloned-with-new-channel",
              targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
              targetFeedIds: [createdFeed.id],
              channelId: newChannelId,
            },
            "token",
            "user-id",
          );

        const updatedFeed = await getFeed(ctx, createdFeed.id);
        const clonedConnection = updatedFeed?.connections.discordChannels.find(
          (c) => c.id === ids[0],
        );

        assert.ok(clonedConnection);
        assert.strictEqual(clonedConnection.details.channel?.id, newChannelId);
        assert.strictEqual(
          clonedConnection.details.channel?.guildId,
          newGuildId,
        );
      });

      it("clones connection to feeds matching search filter", async () => {
        const guildId = "guild-id";
        const connectionIdToUse = objectId();
        const discordUserId = objectId();

        const connection: IDiscordChannelConnection = {
          id: connectionIdToUse,
          name: "source-connection",
          createdAt: new Date(),
          updatedAt: new Date(),
          details: {
            channel: { id: "channel-id", guildId },
            embeds: [],
            content: "test content",
            formatter: { formatTables: false, stripImages: false },
          },
        };

        const matchingFeed1 = await createFeed(ctx, { discordUserId });
        await ctx.container.userFeedRepository.updateById(matchingFeed1.id, {
          $set: { title: "My Awesome Feed" },
        });

        const matchingFeed2 = await createFeed(ctx, { discordUserId });
        await ctx.container.userFeedRepository.updateById(matchingFeed2.id, {
          $set: { title: "Another Awesome Feed" },
        });

        const nonMatchingFeed = await createFeed(ctx, { discordUserId });
        await ctx.container.userFeedRepository.updateById(nonMatchingFeed.id, {
          $set: { title: "Unrelated Feed" },
        });

        const { ids } =
          await ctx.container.feedConnectionsDiscordChannelsService.cloneConnection(
            connection,
            {
              name: "cloned-via-search",
              targetFeedSelectionType: UserFeedTargetFeedSelectionType.All,
              targetFeedSearch: "Awesome",
            },
            "token",
            discordUserId,
          );

        assert.strictEqual(ids.length, 2);

        const updatedMatchingFeed1 = await getFeed(ctx, matchingFeed1.id);
        const updatedMatchingFeed2 = await getFeed(ctx, matchingFeed2.id);
        const updatedNonMatchingFeed = await getFeed(ctx, nonMatchingFeed.id);

        assert.strictEqual(
          updatedMatchingFeed1?.connections.discordChannels.length,
          1,
        );
        assert.strictEqual(
          updatedMatchingFeed2?.connections.discordChannels.length,
          1,
        );
        assert.strictEqual(
          updatedNonMatchingFeed?.connections.discordChannels.length,
          0,
        );
      });

      it("clones connection to all feeds owned by user", async () => {
        const guildId = "guild-id";
        const connectionIdToUse = objectId();
        const ownerDiscordUserId = objectId();
        const otherDiscordUserId = objectId();

        const connection: IDiscordChannelConnection = {
          id: connectionIdToUse,
          name: "source-connection",
          createdAt: new Date(),
          updatedAt: new Date(),
          details: {
            channel: { id: "channel-id", guildId },
            embeds: [],
            content: "test content",
            formatter: { formatTables: false, stripImages: false },
          },
        };

        const ownedFeed1 = await createFeed(ctx, {
          discordUserId: ownerDiscordUserId,
        });
        const ownedFeed2 = await createFeed(ctx, {
          discordUserId: ownerDiscordUserId,
        });
        const otherUserFeed = await createFeed(ctx, {
          discordUserId: otherDiscordUserId,
        });

        const { ids } =
          await ctx.container.feedConnectionsDiscordChannelsService.cloneConnection(
            connection,
            {
              name: "cloned-to-all-owned",
              targetFeedSelectionType: UserFeedTargetFeedSelectionType.All,
            },
            "token",
            ownerDiscordUserId,
          );

        assert.strictEqual(ids.length, 2);

        const updatedOwnedFeed1 = await getFeed(ctx, ownedFeed1.id);
        const updatedOwnedFeed2 = await getFeed(ctx, ownedFeed2.id);
        const updatedOtherUserFeed = await getFeed(ctx, otherUserFeed.id);

        assert.strictEqual(
          updatedOwnedFeed1?.connections.discordChannels.length,
          1,
        );
        assert.strictEqual(
          updatedOwnedFeed2?.connections.discordChannels.length,
          1,
        );
        assert.strictEqual(
          updatedOtherUserFeed?.connections.discordChannels.length,
          0,
        );
      });

      it("clones connection with all properties preserved", async () => {
        const guildId = "guild-id";
        const connectionIdToUse = objectId();

        const connection: IDiscordChannelConnection = {
          id: connectionIdToUse,
          name: "full-connection",
          createdAt: new Date(),
          updatedAt: new Date(),
          disabledCode: FeedConnectionDisabledCode.BadFormat,
          filters: { expression: { type: "article" } },
          splitOptions: { splitChar: "|", appendChar: "...", prependChar: ">" },
          rateLimits: [{ id: "rl1", timeWindowSeconds: 60, limit: 5 }],
          mentions: {
            targets: [
              {
                id: "m1",
                type: FeedConnectionMentionType.Role,
                filters: { expression: { important: true } },
              },
            ],
          },
          details: {
            channel: { id: "channel-id", guildId },
            embeds: [{ title: "Test Embed" }],
            content: "{{title}}",
            formatter: {
              formatTables: true,
              stripImages: true,
              disableImageLinkPreviews: true,
            },
            componentRows: [
              {
                id: "row1",
                components: [
                  {
                    id: "btn1",
                    type: FeedConnectionDiscordComponentType.Button,
                    label: "Click",
                    url: "https://example.com",
                    style: FeedConnectionDiscordComponentButtonStyle.Link,
                  },
                ],
              },
            ],
            enablePlaceholderFallback: true,
            forumThreadTags: [{ id: "tag1" }],
            forumThreadTitle: "Thread: {{title}}",
            placeholderLimits: [
              { characterCount: 100, placeholder: "description" },
            ],
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
                rateLimits: connection.rateLimits,
                mentions: connection.mentions,
                details: {
                  channel: connection.details.channel,
                  embeds: connection.details.embeds,
                  content: connection.details.content,
                  formatter: connection.details.formatter,
                  componentRows: connection.details.componentRows,
                  enablePlaceholderFallback:
                    connection.details.enablePlaceholderFallback,
                  forumThreadTags: connection.details.forumThreadTags,
                  forumThreadTitle: connection.details.forumThreadTitle,
                  placeholderLimits: connection.details.placeholderLimits,
                },
              },
            ],
          },
        });

        const { ids } =
          await ctx.container.feedConnectionsDiscordChannelsService.cloneConnection(
            connection,
            {
              name: "cloned-full",
              targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
              targetFeedIds: [createdFeed.id],
            },
            "token",
            "user-id",
          );

        const updatedFeed = await getFeed(ctx, createdFeed.id);
        const clonedConnection = updatedFeed?.connections.discordChannels.find(
          (c) => c.id === ids[0],
        );

        assert.ok(clonedConnection);
        assert.strictEqual(clonedConnection.name, "cloned-full");
        assert.strictEqual(
          clonedConnection.disabledCode,
          connection.disabledCode,
        );
        assertMatchesObject(clonedConnection.filters!, connection.filters!);
        assertMatchesObject(
          clonedConnection.splitOptions!,
          connection.splitOptions!,
        );
        assertMatchesObject(
          clonedConnection.rateLimits!,
          connection.rateLimits!,
        );
        assertMatchesObject(clonedConnection.mentions!, connection.mentions!);
        assert.strictEqual(
          clonedConnection.details.content,
          connection.details.content,
        );
        assertMatchesObject(
          clonedConnection.details.formatter as Record<string, unknown>,
          connection.details.formatter as Record<string, unknown>,
        );
        assert.strictEqual(
          clonedConnection.details.enablePlaceholderFallback,
          connection.details.enablePlaceholderFallback,
        );
        assert.strictEqual(
          clonedConnection.details.forumThreadTitle,
          connection.details.forumThreadTitle,
        );
      });
    });

    describe("updateDiscordChannelConnection", { concurrency: false }, () => {
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
                splitOptions: {
                  splitChar: "1",
                  appendChar: "2",
                  prependChar: "3",
                },
                details: {
                  channel: { id: "channel-id", guildId },
                  embeds: [{ authorName: "hi" }],
                },
              },
            ],
          },
        });

        mockFeedsService.canUseChannel.mock.mockImplementation(() =>
          Promise.resolve({ guild_id: guildId }),
        );

        const oldConnection = createdFeed.connections.discordChannels[0]!;
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
                    type: CustomPlaceholderStepType.Regex as const,
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
                      id: "btn1",
                      type: FeedConnectionDiscordComponentType.Button as const,
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
          updateInput,
        );

        const updatedFeed = await getFeed(ctx, createdFeed.id);

        assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);

        const updatedConnection = updatedFeed?.connections.discordChannels[0];
        assert.ok(updatedConnection);
        assert.strictEqual(updatedConnection.id, connectionIdToUse);
        assert.strictEqual(updatedConnection.name, updateInput.updates.name);
        assertMatchesObject(
          updatedConnection.filters as unknown as Record<string, unknown>,
          updateInput.updates.filters as unknown as Record<string, unknown>,
        );
        assert.strictEqual(updatedConnection.customPlaceholders?.length, 1);
        assert.strictEqual(
          updatedConnection.customPlaceholders![0]!.id,
          customPlaceholderId,
        );
        assert.strictEqual(
          updatedConnection.customPlaceholders![0]!.referenceName,
          "refe",
        );
        assert.strictEqual(
          updatedConnection.customPlaceholders![0]!.sourcePlaceholder,
          "title",
        );
        assert.strictEqual(
          updatedConnection.customPlaceholders![0]!.steps![0]!.id,
          customPlaceholderStepId,
        );
        assertMatchesObject(
          updatedConnection.details.embeds as unknown as Record<
            string,
            unknown
          >[],
          updateInput.updates.details?.embeds as unknown as Record<
            string,
            unknown
          >[],
        );
        assert.strictEqual(
          updatedConnection.details.channel?.id,
          updateInput.updates.details?.channel?.id,
        );
        assert.strictEqual(updatedConnection.details.channel?.guildId, guildId);
        assert.strictEqual(
          updatedConnection.details.content,
          updateInput.updates.details?.content,
        );
        assertMatchesObject(
          updatedConnection.details.componentRows as unknown as Record<
            string,
            unknown
          >[],
          updateInput.updates.details?.componentRows as unknown as Record<
            string,
            unknown
          >[],
        );
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

        const oldConnection = createdFeed.connections.discordChannels[0]!;

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
          },
        );

        const updatedFeed = await getFeed(ctx, createdFeed.id);

        assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);
        assert.strictEqual(
          updatedFeed?.connections.discordChannels[0]!.disabledCode,
          FeedConnectionDisabledCode.BadFormat,
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

        const oldConnection = createdFeed.connections.discordChannels[0]!;
        const splitOptions = { splitChar: "s", appendChar: "a" };

        await ctx.container.feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
          createdFeed.id,
          connectionIdToUse,
          {
            accessToken: "access-token",
            oldConnection,
            feed: createdFeed,
            updates: { splitOptions },
          },
        );

        const updatedFeed = await getFeed(ctx, createdFeed.id);

        assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);
        assertMatchesObject(
          updatedFeed?.connections.discordChannels[0]!.splitOptions as Record<
            string,
            unknown
          >,
          splitOptions as Record<string, unknown>,
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
                splitOptions: {
                  splitChar: "1",
                  appendChar: "2",
                  prependChar: "3",
                },
                details: { channel: { id: "channel-id", guildId } },
              },
            ],
          },
        });

        const oldConnection = createdFeed.connections.discordChannels[0]!;

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
          },
        );

        const updatedFeed = await getFeed(ctx, createdFeed.id);

        assert.strictEqual(updatedFeed?.connections.discordChannels.length, 1);
        assert.strictEqual(
          updatedFeed?.connections.discordChannels[0]!.filters,
          undefined,
        );
        assert.strictEqual(
          updatedFeed?.connections.discordChannels[0]!.disabledCode,
          undefined,
        );
        assert.strictEqual(
          updatedFeed?.connections.discordChannels[0]!.splitOptions,
          undefined,
        );
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

        const oldConnection = createdFeed.connections.discordChannels[0]!;

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
              },
            ),
          MissingDiscordChannelException,
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

        const oldConnection = createdFeed.connections.discordChannels[0]!;

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
              },
            ),
          DiscordChannelPermissionsException,
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
          Promise.resolve({ errors: ["1", "2"] }),
        );

        const oldConnection = createdFeed.connections.discordChannels[0]!;

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
              },
            ),
          InvalidFilterExpressionException,
        );
      });
    });

    describe("copySettings", { concurrency: false }, () => {
      it("copies settings correctly", async () => {
        const guildId = "guild-id";
        const sourceConnectionId = objectId();
        const targetConnectionId1 = objectId();
        const targetConnectionId2 = objectId();

        const sourceConnection: DeepPartial<IDiscordChannelConnection> = {
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
              channelId: "channel-id",
              guildId: "guild-id",
              token: "token",
              iconUrl: "icon-url",
              name: "name",
              isApplicationOwned: true,
              threadId: "thread-id",
            },
            embeds: [
              { authorName: "auth name", authorURL: "auth url", fields: [] },
            ],
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
                    style: FeedConnectionDiscordComponentButtonStyle.Link,
                    type: FeedConnectionDiscordComponentType.Button,
                    url: "url",
                  },
                ],
              },
            ],
            content: "content",
            enablePlaceholderFallback: true,
            forumThreadTags: [
              { id: "1", filters: { expression: { hello: "world" } } },
            ],
            forumThreadTitle: "forum-thread-title",
            placeholderLimits: [
              {
                characterCount: 100,
                placeholder: "placeholder",
                appendString: "append-string",
              },
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
                    channelId: "channel-id",
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
                splitOptions: {
                  splitChar: "1",
                  appendChar: "2",
                  prependChar: "3",
                },
                details: {
                  channel: { id: "channel-id3", guildId },
                  webhook: {
                    id: "webhook-id-3",
                    channelId: "channel-id",
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
          (c) => c.id === sourceConnectionId,
        )!;

        await ctx.container.feedConnectionsDiscordChannelsService.copySettings(
          feedAfterCreate!,
          sourceConn,
          {
            properties: Object.values(CopyableSetting),
            targetDiscordChannelConnectionIds: [
              targetConnectionId1,
              targetConnectionId2,
            ],
            accessToken: "fake-access-token",
          },
        );

        const updatedFeed = await getFeed(ctx, createdFeed.id);

        assert.strictEqual(updatedFeed?.connections.discordChannels.length, 3);

        const targetConnections =
          updatedFeed?.connections.discordChannels.filter(
            (c) => c.id === targetConnectionId1 || c.id === targetConnectionId2,
          );

        assert.strictEqual(targetConnections?.length, 2);

        for (const c of targetConnections!) {
          assertMatchesObject(
            c.filters as unknown as Record<string, unknown>,
            sourceConnection.filters as unknown as Record<string, unknown>,
          );
          assertMatchesObject(
            c.splitOptions as Record<string, unknown>,
            sourceConnection.splitOptions as Record<string, unknown>,
          );
          assertMatchesObject(
            c.rateLimits as unknown as Record<string, unknown>,
            sourceConnection.rateLimits as unknown as Record<string, unknown>,
          );
          assertMatchesObject(
            c.mentions as unknown as Record<string, unknown>,
            sourceConnection.mentions as unknown as Record<string, unknown>,
          );
          assertMatchesObject(
            c.details.embeds as unknown as Record<string, unknown>,
            sourceConnection.details!.embeds as unknown as Record<
              string,
              unknown
            >,
          );
          assertMatchesObject(
            c.details.formatter as unknown as Record<string, unknown>,
            sourceConnection.details!.formatter as unknown as Record<
              string,
              unknown
            >,
          );
          assert.strictEqual(
            c.details.content,
            sourceConnection.details!.content,
          );
          assertMatchesObject(
            c.details.componentRows as unknown as Record<string, unknown>,
            sourceConnection.details!.componentRows as unknown as Record<
              string,
              unknown
            >,
          );
          assert.strictEqual(
            c.details.enablePlaceholderFallback,
            sourceConnection.details!.enablePlaceholderFallback,
          );
          assertMatchesObject(
            c.details.forumThreadTags as unknown as Record<string, unknown>,
            sourceConnection.details!.forumThreadTags as unknown as Record<
              string,
              unknown
            >,
          );
          assert.strictEqual(
            c.details.forumThreadTitle,
            sourceConnection.details!.forumThreadTitle,
          );
          assertMatchesObject(
            c.details.placeholderLimits as unknown as Record<string, unknown>,
            sourceConnection.details!.placeholderLimits as unknown as Record<
              string,
              unknown
            >,
          );
          assert.strictEqual(
            c.details.webhook?.iconUrl,
            sourceConnection.details!.webhook?.iconUrl,
          );
          assert.strictEqual(
            c.details.webhook?.name,
            sourceConnection.details!.webhook?.name,
          );
          assert.strictEqual(
            c.details.webhook?.threadId,
            sourceConnection.details!.webhook?.threadId,
          );
        }
      });
    });

    describe("deleteConnection", { concurrency: false }, () => {
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
          connectionIdToUse,
        );

        const updatedFeed = await getFeed(ctx, createdFeed.id);

        assert.strictEqual(updatedFeed?.connections.discordChannels.length, 0);
      });
    });

    describe("sendTestArticle", { concurrency: false }, () => {
      it("calls feedHandlerService.sendTestArticle with correct args", async () => {
        const connectionIdToUse = objectId();
        const guildId = "guild-id";

        const createdFeed = await createFeed(ctx, {
          connections: {
            discordChannels: [
              {
                id: connectionIdToUse,
                name: "name",
                details: {
                  channel: { id: "channel-id", guildId },
                  embeds: [],
                },
              },
            ],
          },
        });

        const targetConnection = createdFeed.connections.discordChannels[0];
        assert.ok(targetConnection, "Target connection should exist");

        await ctx.container.feedConnectionsDiscordChannelsService.sendTestArticle(
          createdFeed,
          targetConnection,
        );

        assert.strictEqual(
          mockFeedHandlerService.sendTestArticle.mock.calls.length,
          1,
        );

        const callArg = mockFeedHandlerService.sendTestArticle.mock.calls[0]!
          .arguments[0] as {
          details: {
            type: string;
            feed: { url: string };
            article?: { id: string };
            mediumDetails: { channel: { id: string }; content: string };
          };
        };
        assert.strictEqual(callArg.details.type, "discord");
        assert.strictEqual(callArg.details.feed.url, createdFeed.url);
        assert.strictEqual(callArg.details.article, undefined);
        assert.strictEqual(
          callArg.details.mediumDetails.channel.id,
          targetConnection.details.channel!.id,
        );
        assert.ok(typeof callArg.details.mediumDetails.content === "string");
      });

      it("calls sendTestArticle with specific article if field exists", async () => {
        const connectionIdToUse = objectId();
        const guildId = "guild-id";

        const createdFeed = await createFeed(ctx, {
          connections: {
            discordChannels: [
              {
                id: connectionIdToUse,
                name: "name",
                details: {
                  channel: { id: "channel-id", guildId },
                  embeds: [],
                },
              },
            ],
          },
        });

        const targetConnection = createdFeed.connections.discordChannels[0];
        assert.ok(targetConnection, "Target connection should exist");

        await ctx.container.feedConnectionsDiscordChannelsService.sendTestArticle(
          createdFeed,
          targetConnection,
          {
            article: {
              id: "article-1",
            },
          },
        );

        assert.strictEqual(
          mockFeedHandlerService.sendTestArticle.mock.calls.length,
          1,
        );

        const callArg = mockFeedHandlerService.sendTestArticle.mock.calls[0]!
          .arguments[0] as {
          details: { article?: { id: string } };
        };
        assert.deepStrictEqual(callArg.details.article, { id: "article-1" });
      });

      it("returns the result from feedHandlerService", async () => {
        const connectionIdToUse = objectId();
        const guildId = "guild-id";
        const testResult = {
          status: TestDeliveryStatus.Success,
          apiResponse: { messageId: "123" },
        };

        mockFeedHandlerService.sendTestArticle.mock.mockImplementation(() =>
          Promise.resolve(testResult),
        );

        const createdFeed = await createFeed(ctx, {
          connections: {
            discordChannels: [
              {
                id: connectionIdToUse,
                name: "name",
                details: {
                  channel: { id: "channel-id", guildId },
                  embeds: [],
                },
              },
            ],
          },
        });

        const targetConnection = createdFeed.connections.discordChannels[0];
        assert.ok(targetConnection, "Target connection should exist");

        const result =
          await ctx.container.feedConnectionsDiscordChannelsService.sendTestArticle(
            createdFeed,
            targetConnection,
          );

        assert.deepStrictEqual(result, testResult);
      });

      it("strips custom placeholders when user is not allowed", async () => {
        const connectionIdToUse = objectId();
        const guildId = "guild-id";

        mockSupportersService.getBenefitsOfDiscordUser.mock.mockImplementation(
          () =>
            Promise.resolve({
              allowCustomPlaceholders: false,
              allowExternalProperties: true,
            }),
        );

        const createdFeed = await createFeed(ctx, {
          connections: {
            discordChannels: [
              {
                id: connectionIdToUse,
                name: "name",
                details: {
                  channel: { id: "channel-id", guildId },
                  embeds: [],
                },
              },
            ],
          },
        });

        const targetConnection = createdFeed.connections.discordChannels[0];
        assert.ok(targetConnection, "Target connection should exist");

        await ctx.container.feedConnectionsDiscordChannelsService.sendTestArticle(
          createdFeed,
          targetConnection,
          {
            previewInput: {
              customPlaceholders: [
                {
                  id: "placeholder-1",
                  referenceName: "test",
                  sourcePlaceholder: "title",
                  steps: [],
                },
              ],
            },
          },
        );

        assert.strictEqual(
          mockFeedHandlerService.sendTestArticle.mock.calls.length,
          1,
        );

        const callArg = mockFeedHandlerService.sendTestArticle.mock.calls[0]!
          .arguments[0] as {
          details: {
            mediumDetails: {
              customPlaceholders: Array<unknown>;
            };
          };
        };
        assert.deepStrictEqual(
          callArg.details.mediumDetails.customPlaceholders,
          [],
        );
      });

      it("strips external properties when user is not allowed", async () => {
        const connectionIdToUse = objectId();
        const guildId = "guild-id";

        mockSupportersService.getBenefitsOfDiscordUser.mock.mockImplementation(
          () =>
            Promise.resolve({
              allowCustomPlaceholders: true,
              allowExternalProperties: false,
            }),
        );

        const createdFeed = await createFeed(ctx, {
          connections: {
            discordChannels: [
              {
                id: connectionIdToUse,
                name: "name",
                details: {
                  channel: { id: "channel-id", guildId },
                  embeds: [],
                },
              },
            ],
          },
        });

        const targetConnection = createdFeed.connections.discordChannels[0];
        assert.ok(targetConnection, "Target connection should exist");

        await ctx.container.feedConnectionsDiscordChannelsService.sendTestArticle(
          createdFeed,
          targetConnection,
          {
            previewInput: {
              externalProperties: [
                {
                  sourceField: "field1",
                  label: "Label 1",
                  cssSelector: ".selector",
                },
              ],
            },
          },
        );

        assert.strictEqual(
          mockFeedHandlerService.sendTestArticle.mock.calls.length,
          1,
        );

        const callArg = mockFeedHandlerService.sendTestArticle.mock.calls[0]!
          .arguments[0] as {
          details: {
            feed: {
              externalProperties: Array<unknown>;
            };
          };
        };
        assert.deepStrictEqual(callArg.details.feed.externalProperties, []);
      });

      it("filters out embed fields without name or value", async () => {
        const connectionIdToUse = objectId();
        const guildId = "guild-id";

        const createdFeed = await createFeed(ctx, {
          connections: {
            discordChannels: [
              {
                id: connectionIdToUse,
                name: "name",
                details: {
                  channel: { id: "channel-id", guildId },
                  embeds: [],
                },
              },
            ],
          },
        });

        const targetConnection = createdFeed.connections.discordChannels[0];
        assert.ok(targetConnection, "Target connection should exist");

        await ctx.container.feedConnectionsDiscordChannelsService.sendTestArticle(
          createdFeed,
          targetConnection,
          {
            previewInput: {
              embeds: [
                {
                  title: "Test Embed",
                  fields: [
                    { name: "Valid", value: "Field" },
                    { name: "", value: "Missing name" },
                    { name: "Missing value", value: "" },
                    { name: null, value: "Null name" },
                    { name: "Null value", value: null },
                  ],
                },
              ],
            },
          },
        );

        assert.strictEqual(
          mockFeedHandlerService.sendTestArticle.mock.calls.length,
          1,
        );

        const callArg = mockFeedHandlerService.sendTestArticle.mock.calls[0]!
          .arguments[0] as {
          details: {
            mediumDetails: {
              embeds: Array<{
                fields: Array<{ name: string; value: string }>;
              }>;
            };
          };
        };

        assert.strictEqual(callArg.details.mediumDetails.embeds.length, 1);
        assert.strictEqual(
          callArg.details.mediumDetails.embeds[0]!.fields.length,
          1,
        );
        assert.deepStrictEqual(
          callArg.details.mediumDetails.embeds[0]!.fields[0],
          {
            name: "Valid",
            value: "Field",
            inline: undefined,
          },
        );
      });
    });
  },
);
