import { describe, it } from "node:test";
import assert from "node:assert";
import { createMessageBrokerEventsHarness } from "../helpers/message-broker-events.harness";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  FeedConnectionDisabledCode,
} from "../../src/repositories/shared/enums";
import { FeedFetcherFetchStatus } from "../../src/services/feed-fetcher-api/types";
import { ArticleRejectCode } from "../../src/shared/enums/article-reject-code";
import { FeedRejectCode } from "../../src/shared/enums/feed-reject-code";

describe("MessageBrokerEventsService", { concurrency: true }, () => {
  const harness = createMessageBrokerEventsHarness();

  describe("handleSyncSupporterDiscordRoles", () => {
    it("should call supportersService.syncDiscordSupporterRoles with the userId", async () => {
      const ctx = harness.createContext();
      const userId = "user-123";

      await ctx.service.handleSyncSupporterDiscordRoles({
        data: { userId },
      });

      assert.strictEqual(
        ctx.supportersService.syncDiscordSupporterRoles.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.supportersService.syncDiscordSupporterRoles.mock.calls[0]
          ?.arguments,
        [userId],
      );
    });
  });

  describe("handleUrlFailing", () => {
    it("should update health status to Failing by url when no lookupKey", async () => {
      const ctx = harness.createContext();
      const url = "https://example.com/feed.xml";

      await ctx.service.handleUrlFailing({
        data: { url },
      });

      assert.strictEqual(
        ctx.userFeedRepository.updateHealthStatusByFilter.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.updateHealthStatusByFilter.mock.calls[0]
          ?.arguments,
        [{ url }, UserFeedHealthStatus.Failing, UserFeedHealthStatus.Failing],
      );
    });

    it("should update health status to Failing by lookupKey when provided", async () => {
      const ctx = harness.createContext();
      const url = "https://example.com/feed.xml";
      const lookupKey = "lookup-key-123";

      await ctx.service.handleUrlFailing({
        data: { url, lookupKey },
      });

      assert.strictEqual(
        ctx.userFeedRepository.updateHealthStatusByFilter.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.updateHealthStatusByFilter.mock.calls[0]
          ?.arguments,
        [
          { lookupKey },
          UserFeedHealthStatus.Failing,
          UserFeedHealthStatus.Failing,
        ],
      );
    });
  });

  describe("handleUrlFetchCompletedEvent", () => {
    it("should update health status to Ok when feeds are not Ok", async () => {
      const ctx = harness.createContext({
        userFeedRepository: {
          countWithHealthStatusFilterResult: 1,
        },
      });

      await ctx.service.handleUrlFetchCompletedEvent({
        data: {
          url: "https://example.com/feed.xml",
          rateSeconds: 600,
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.countWithHealthStatusFilter.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.countWithHealthStatusFilter.mock.calls[0]
          ?.arguments,
        [{ url: "https://example.com/feed.xml" }, UserFeedHealthStatus.Ok],
      );
      assert.strictEqual(
        ctx.userFeedRepository.updateHealthStatusByFilter.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.updateHealthStatusByFilter.mock.calls[0]
          ?.arguments,
        [
          { url: "https://example.com/feed.xml" },
          UserFeedHealthStatus.Ok,
          UserFeedHealthStatus.Ok,
        ],
      );
    });

    it("should skip health status update when all feeds are already Ok", async () => {
      const ctx = harness.createContext({
        userFeedRepository: {
          countWithHealthStatusFilterResult: 0,
        },
      });

      await ctx.service.handleUrlFetchCompletedEvent({
        data: {
          url: "https://example.com/feed.xml",
          rateSeconds: 600,
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.updateHealthStatusByFilter.mock.callCount(),
        0,
      );
    });

    it("should iterate feeds and emit delivery events", async () => {
      const mockFeed = {
        id: "feed-123",
        url: "https://example.com/feed.xml",
        maxDailyArticles: 100,
        connections: {
          discordChannels: [],
        },
        user: {
          discordUserId: "user-123",
        },
        users: [
          {
            externalCredentials: [],
            preferences: {},
          },
        ],
      };

      const ctx = harness.createContext({
        userFeedRepository: {
          iterateFeedsForDeliveryResult: (async function* () {
            yield mockFeed;
          })(),
        },
      });

      await ctx.service.handleUrlFetchCompletedEvent({
        data: {
          url: "https://example.com/feed.xml",
          rateSeconds: 600,
        },
      });

      assert.strictEqual(ctx.publishMessage.mock.callCount(), 1);
    });

    it("should use lookupKey iteration when lookupKey is provided", async () => {
      const mockFeed = {
        id: "feed-123",
        url: "https://example.com/feed.xml",
        maxDailyArticles: 100,
        connections: {
          discordChannels: [],
        },
        user: {
          discordUserId: "user-123",
        },
        users: [{}],
      };

      const ctx = harness.createContext({
        userFeedRepository: {
          iterateFeedsWithLookupKeysForDeliveryResult: (async function* () {
            yield mockFeed;
          })(),
        },
      });

      await ctx.service.handleUrlFetchCompletedEvent({
        data: {
          url: "https://example.com/feed.xml",
          lookupKey: "lookup-key-123",
          rateSeconds: 600,
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.iterateFeedsWithLookupKeysForDelivery.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.iterateFeedsWithLookupKeysForDelivery.mock
          .calls[0]?.arguments,
        [
          {
            lookupKey: "lookup-key-123",
            refreshRateSeconds: 600,
            debug: undefined,
          },
        ],
      );
    });

    it("should check premium benefits when feed has custom placeholders", async () => {
      const mockFeed = {
        id: "feed-123",
        url: "https://example.com/feed.xml",
        maxDailyArticles: 100,
        connections: {
          discordChannels: [
            {
              id: "conn-1",
              customPlaceholders: [{ id: "placeholder-1", steps: [] }],
              details: { channel: { id: "ch-1", guildId: "g-1" } },
            },
          ],
        },
        user: {
          discordUserId: "user-123",
        },
        users: [{}],
      };

      const ctx = harness.createContext({
        userFeedRepository: {
          iterateFeedsForDeliveryResult: (async function* () {
            yield mockFeed;
          })(),
        },
        supportersService: {
          getBenefitsResult: {
            allowCustomPlaceholders: true,
            allowExternalProperties: false,
          },
        },
      });

      await ctx.service.handleUrlFetchCompletedEvent({
        data: {
          url: "https://example.com/feed.xml",
          rateSeconds: 600,
        },
      });

      assert.strictEqual(
        ctx.supportersService.getBenefitsOfDiscordUser.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.supportersService.getBenefitsOfDiscordUser.mock.calls[0]?.arguments,
        ["user-123"],
      );
    });

    it("should check premium benefits when feed has external properties", async () => {
      const mockFeed = {
        id: "feed-123",
        url: "https://example.com/feed.xml",
        maxDailyArticles: 100,
        externalProperties: [
          {
            id: "prop-1",
            sourceField: "title",
            cssSelector: ".title",
            label: "Title",
          },
        ],
        connections: {
          discordChannels: [
            {
              id: "conn-1",
              details: { channel: { id: "ch-1", guildId: "g-1" } },
            },
          ],
        },
        user: {
          discordUserId: "user-123",
        },
        users: [{}],
      };

      const ctx = harness.createContext({
        userFeedRepository: {
          iterateFeedsForDeliveryResult: (async function* () {
            yield mockFeed;
          })(),
        },
        supportersService: {
          getBenefitsResult: {
            allowCustomPlaceholders: false,
            allowExternalProperties: true,
          },
        },
      });

      await ctx.service.handleUrlFetchCompletedEvent({
        data: {
          url: "https://example.com/feed.xml",
          rateSeconds: 600,
        },
      });

      assert.strictEqual(
        ctx.supportersService.getBenefitsOfDiscordUser.mock.callCount(),
        1,
      );
    });

    it("should not check premium benefits when feed has no premium features", async () => {
      const mockFeed = {
        id: "feed-123",
        url: "https://example.com/feed.xml",
        maxDailyArticles: 100,
        connections: {
          discordChannels: [
            {
              id: "conn-1",
              details: { channel: { id: "ch-1", guildId: "g-1" } },
            },
          ],
        },
        user: {
          discordUserId: "user-123",
        },
        users: [{}],
      };

      const ctx = harness.createContext({
        userFeedRepository: {
          iterateFeedsForDeliveryResult: (async function* () {
            yield mockFeed;
          })(),
        },
      });

      await ctx.service.handleUrlFetchCompletedEvent({
        data: {
          url: "https://example.com/feed.xml",
          rateSeconds: 600,
        },
      });

      assert.strictEqual(
        ctx.supportersService.getBenefitsOfDiscordUser.mock.callCount(),
        0,
      );
    });

    it("should continue processing other feeds when one feed fails", async () => {
      let callCount = 0;
      const mockFeed1 = {
        id: "feed-1",
        url: "https://example.com/feed1.xml",
        maxDailyArticles: 100,
        connections: {
          discordChannels: [
            {
              id: "conn-1",
              customPlaceholders: [{ id: "p1", steps: [] }],
              details: { channel: { id: "ch-1", guildId: "g-1" } },
            },
          ],
        },
        user: { discordUserId: "user-1" },
        users: [{}],
      };
      const mockFeed2 = {
        id: "feed-2",
        url: "https://example.com/feed2.xml",
        maxDailyArticles: 100,
        connections: { discordChannels: [] },
        user: { discordUserId: "user-2" },
        users: [{}],
      };

      const ctx = harness.createContext({
        userFeedRepository: {
          iterateFeedsForDeliveryResult: (async function* () {
            yield mockFeed1;
            yield mockFeed2;
          })(),
        },
        supportersService: {
          getBenefitsResult: {
            allowCustomPlaceholders: true,
            allowExternalProperties: false,
          },
        },
      });

      ctx.supportersService.getBenefitsOfDiscordUser = {
        mock: {
          callCount: () => callCount,
          calls: [],
        },
      } as never;

      const originalGetBenefits =
        ctx.supportersService.getBenefitsOfDiscordUser;
      (
        ctx.service as unknown as {
          deps: {
            supportersService: {
              getBenefitsOfDiscordUser: () => Promise<unknown>;
            };
          };
        }
      ).deps.supportersService.getBenefitsOfDiscordUser = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Simulated error");
        }
        return {
          allowCustomPlaceholders: false,
          allowExternalProperties: false,
        };
      };

      await ctx.service.handleUrlFetchCompletedEvent({
        data: {
          url: "https://example.com/feed.xml",
          rateSeconds: 600,
        },
      });

      assert.strictEqual(ctx.publishMessage.mock.callCount(), 1);
    });
  });

  describe("handleUrlRejectedDisableFeedsEvent", () => {
    it("should atomically disable feeds with FeedTooLarge when status is RefusedLargeFeed", async () => {
      const ctx = harness.createContext({
        userFeedRepository: {
          disableFeedsByFilterIfNotDisabledResult: 2,
        },
      });

      await ctx.service.handleUrlRejectedDisableFeedsEvent({
        data: {
          url: "https://example.com/feed.xml",
          status: FeedFetcherFetchStatus.RefusedLargeFeed,
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.disableFeedsByFilterIfNotDisabled.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.disableFeedsByFilterIfNotDisabled.mock.calls[0]
          ?.arguments,
        [
          { url: "https://example.com/feed.xml" },
          UserFeedDisabledCode.FeedTooLarge,
        ],
      );
    });

    it("should use lookupKey filter when provided", async () => {
      const ctx = harness.createContext();

      await ctx.service.handleUrlRejectedDisableFeedsEvent({
        data: {
          url: "https://example.com/feed.xml",
          lookupKey: "lookup-key-123",
          status: FeedFetcherFetchStatus.RefusedLargeFeed,
        },
      });

      assert.deepStrictEqual(
        ctx.userFeedRepository.disableFeedsByFilterIfNotDisabled.mock.calls[0]
          ?.arguments,
        [{ lookupKey: "lookup-key-123" }, UserFeedDisabledCode.FeedTooLarge],
      );
    });
  });

  describe("handleUrlRequestFailureEvent", () => {
    it("should atomically disable feeds and set health status to Failed", async () => {
      const feedIds = ["feed-1", "feed-2"];
      const ctx = harness.createContext({
        userFeedRepository: {
          findIdsWithoutDisabledCodeResult: feedIds,
        },
      });

      await ctx.service.handleUrlRequestFailureEvent({
        data: { url: "https://example.com/feed.xml" },
      });

      assert.strictEqual(
        ctx.userFeedRepository.disableFeedsAndSetHealthStatus.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.disableFeedsAndSetHealthStatus.mock.calls[0]
          ?.arguments,
        [
          feedIds,
          UserFeedDisabledCode.FailedRequests,
          UserFeedHealthStatus.Failed,
        ],
      );
    });

    it("should send disabled feeds alert after disabling", async () => {
      const feedIds = ["feed-1", "feed-2"];
      const ctx = harness.createContext({
        userFeedRepository: {
          findIdsWithoutDisabledCodeResult: feedIds,
        },
      });

      await ctx.service.handleUrlRequestFailureEvent({
        data: { url: "https://example.com/feed.xml" },
      });

      assert.strictEqual(
        ctx.notificationsService.sendDisabledFeedsAlert.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.notificationsService.sendDisabledFeedsAlert.mock.calls[0]
          ?.arguments,
        [feedIds, { disabledCode: UserFeedDisabledCode.FailedRequests }],
      );
    });

    it("should not disable or send alert when no feeds to disable", async () => {
      const ctx = harness.createContext({
        userFeedRepository: {
          findIdsWithoutDisabledCodeResult: [],
        },
      });

      await ctx.service.handleUrlRequestFailureEvent({
        data: { url: "https://example.com/feed.xml" },
      });

      assert.strictEqual(
        ctx.userFeedRepository.disableFeedsAndSetHealthStatus.mock.callCount(),
        0,
      );
      assert.strictEqual(
        ctx.notificationsService.sendDisabledFeedsAlert.mock.callCount(),
        0,
      );
    });
  });

  describe("handleFeedRejectedDisableFeed", () => {
    it("should disable feed and send alert when feed exists and not already disabled", async () => {
      const mockFeed = {
        id: "feed-123",
        title: "Test Feed",
        url: "https://example.com/feed.xml",
        connections: { discordChannels: [] },
      };
      const ctx = harness.createContext({
        userFeedRepository: {
          findByIdResult: mockFeed,
          disableFeedByIdIfNotDisabledResult: true,
        },
      });

      await ctx.service.handleFeedRejectedDisableFeed({
        data: {
          feed: { id: "feed-123" },
          rejectedCode: FeedRejectCode.InvalidFeed,
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.disableFeedByIdIfNotDisabled.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.disableFeedByIdIfNotDisabled.mock.calls[0]
          ?.arguments,
        ["feed-123", UserFeedDisabledCode.InvalidFeed],
      );
      assert.strictEqual(
        ctx.notificationsService.sendDisabledFeedsAlert.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.notificationsService.sendDisabledFeedsAlert.mock.calls[0]
          ?.arguments,
        [["feed-123"], { disabledCode: UserFeedDisabledCode.InvalidFeed }],
      );
    });

    it("should not send alert when feed already has disabledCode", async () => {
      const mockFeed = {
        id: "feed-123",
        title: "Test Feed",
        url: "https://example.com/feed.xml",
        connections: { discordChannels: [] },
      };
      const ctx = harness.createContext({
        userFeedRepository: {
          findByIdResult: mockFeed,
          disableFeedByIdIfNotDisabledResult: false,
        },
      });

      await ctx.service.handleFeedRejectedDisableFeed({
        data: {
          feed: { id: "feed-123" },
          rejectedCode: FeedRejectCode.InvalidFeed,
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.disableFeedByIdIfNotDisabled.mock.callCount(),
        1,
      );
      assert.strictEqual(
        ctx.notificationsService.sendDisabledFeedsAlert.mock.callCount(),
        0,
      );
    });

    it("should do nothing when feed does not exist", async () => {
      const ctx = harness.createContext({
        userFeedRepository: {
          findByIdResult: null,
        },
      });

      await ctx.service.handleFeedRejectedDisableFeed({
        data: {
          feed: { id: "non-existent-feed" },
          rejectedCode: FeedRejectCode.InvalidFeed,
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.disableFeedByIdIfNotDisabled.mock.callCount(),
        0,
      );
      assert.strictEqual(
        ctx.notificationsService.sendDisabledFeedsAlert.mock.callCount(),
        0,
      );
    });
  });

  describe("handleRejectedArticleDisableConnection", () => {
    it("should disable connection and send alert when feed and connection exist", async () => {
      const mockFeed = {
        id: "feed-123",
        title: "Test Feed",
        url: "https://example.com/feed.xml",
        connections: {
          discordChannels: [
            {
              id: "connection-123",
              name: "Test Connection",
              details: {},
            },
          ],
        },
        user: { discordUserId: "user-123" },
      };
      const ctx = harness.createContext({
        userFeedRepository: {
          findByIdResult: mockFeed,
        },
      });

      await ctx.service.handleRejectedArticleDisableConnection({
        data: {
          rejectedCode: ArticleRejectCode.BadRequest,
          medium: { id: "connection-123" },
          feed: { id: "feed-123" },
          articleId: "article-1",
          rejectedMessage: "Bad format error",
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.setConnectionDisabledCode.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.setConnectionDisabledCode.mock.calls[0]
          ?.arguments,
        [
          "feed-123",
          "discordChannels",
          0,
          FeedConnectionDisabledCode.BadFormat,
          "Bad format error",
        ],
      );
      assert.strictEqual(
        ctx.notificationsService.sendDisabledFeedConnectionAlert.mock.callCount(),
        1,
      );
    });

    it("should not send alert when feed does not exist", async () => {
      const ctx = harness.createContext({
        userFeedRepository: {
          findByIdResult: null,
        },
      });

      await ctx.service.handleRejectedArticleDisableConnection({
        data: {
          rejectedCode: ArticleRejectCode.BadRequest,
          medium: { id: "connection-123" },
          feed: { id: "non-existent-feed" },
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.setConnectionDisabledCode.mock.callCount(),
        0,
      );
      assert.strictEqual(
        ctx.notificationsService.sendDisabledFeedConnectionAlert.mock.callCount(),
        0,
      );
    });

    it("should map ArticleRejectCode.Forbidden to MissingPermissions", async () => {
      const mockFeed = {
        id: "feed-123",
        connections: {
          discordChannels: [
            { id: "connection-123", name: "Test", details: {} },
          ],
        },
      };
      const ctx = harness.createContext({
        userFeedRepository: {
          findByIdResult: mockFeed,
        },
      });

      await ctx.service.handleRejectedArticleDisableConnection({
        data: {
          rejectedCode: ArticleRejectCode.Forbidden,
          medium: { id: "connection-123" },
          feed: { id: "feed-123" },
        },
      });

      assert.deepStrictEqual(
        ctx.userFeedRepository.setConnectionDisabledCode.mock.calls[0]
          ?.arguments,
        [
          "feed-123",
          "discordChannels",
          0,
          FeedConnectionDisabledCode.MissingPermissions,
          undefined,
        ],
      );
    });

    it("should map ArticleRejectCode.MediumNotFound to MissingMedium", async () => {
      const mockFeed = {
        id: "feed-123",
        connections: {
          discordChannels: [
            { id: "connection-123", name: "Test", details: {} },
          ],
        },
      };
      const ctx = harness.createContext({
        userFeedRepository: {
          findByIdResult: mockFeed,
        },
      });

      await ctx.service.handleRejectedArticleDisableConnection({
        data: {
          rejectedCode: ArticleRejectCode.MediumNotFound,
          medium: { id: "connection-123" },
          feed: { id: "feed-123" },
        },
      });

      assert.deepStrictEqual(
        ctx.userFeedRepository.setConnectionDisabledCode.mock.calls[0]
          ?.arguments,
        [
          "feed-123",
          "discordChannels",
          0,
          FeedConnectionDisabledCode.MissingMedium,
          undefined,
        ],
      );
    });
  });

  describe("emitDeliverFeedArticlesEvent", () => {
    it("should publish message to feed.deliver-articles queue", async () => {
      const ctx = harness.createContext();
      const userFeed = {
        id: "feed-123",
        url: "https://example.com/feed.xml",
        connections: {
          discordChannels: [
            {
              id: "connection-123",
              name: "Test Connection",
              details: {
                channel: {
                  id: "channel-123",
                  guildId: "guild-123",
                },
                embeds: [],
                formatter: {},
              },
              filters: null,
              rateLimits: [],
              mentions: null,
              customPlaceholders: [],
              splitOptions: null,
              createdAt: new Date(),
            },
          ],
        },
        passingComparisons: [],
        blockingComparisons: [],
        formatOptions: {},
        externalProperties: [],
        dateCheckOptions: {},
      };

      await ctx.service.emitDeliverFeedArticlesEvent({
        userFeed: userFeed as never,
        maxDailyArticles: 100,
        parseCustomPlaceholders: false,
        parseExternalProperties: false,
        user: { externalCredentials: [], preferences: {} } as never,
      });

      assert.strictEqual(ctx.publishMessage.mock.callCount(), 1);
      const [queue, message, options] =
        ctx.publishMessage.mock.calls[0]?.arguments || [];
      assert.strictEqual(queue, "feed.deliver-articles");
      assert.ok((message as { timestamp: number }).timestamp);
      assert.strictEqual(
        (message as { source: string }).source,
        "backend-api::message-broker-events",
      );
      assert.strictEqual(
        (message as { data: { articleDayLimit: number } }).data.articleDayLimit,
        100,
      );
      assert.strictEqual(
        (message as { data: { feed: { id: string } } }).data.feed.id,
        "feed-123",
      );
      assert.deepStrictEqual(options, { expiration: 600000 });
    });

    it("should filter out disabled connections", async () => {
      const ctx = harness.createContext();
      const userFeed = {
        id: "feed-123",
        url: "https://example.com/feed.xml",
        connections: {
          discordChannels: [
            {
              id: "connection-1",
              name: "Enabled",
              details: {
                channel: { id: "ch-1", guildId: "g-1" },
                embeds: [],
                formatter: {},
              },
            },
            {
              id: "connection-2",
              name: "Disabled",
              disabledCode: "MANUAL",
              details: {
                channel: { id: "ch-2", guildId: "g-1" },
                embeds: [],
                formatter: {},
              },
            },
          ],
        },
        passingComparisons: [],
        blockingComparisons: [],
        formatOptions: {},
      };

      await ctx.service.emitDeliverFeedArticlesEvent({
        userFeed: userFeed as never,
        maxDailyArticles: 100,
        parseCustomPlaceholders: false,
        parseExternalProperties: false,
      });

      const [, message] = ctx.publishMessage.mock.calls[0]?.arguments || [];
      const mediums = (message as { data: { mediums: { id: string }[] } }).data
        .mediums;
      assert.strictEqual(mediums.length, 1);
      assert.strictEqual(mediums[0]?.id, "connection-1");
    });
  });
});
