import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createScheduleHandlerHarness,
  generateEncryptionKey,
} from "../helpers/schedule-handler.harness";

const DEFAULT_REFRESH_RATE_SECONDS = 600;
const DEFAULT_MAX_DAILY_ARTICLES = 100;
const SUPPORTER_REFRESH_RATE = 120;
const SUPPORTER_MAX_DAILY_ARTICLES = 500;

describe("ScheduleHandlerService", { concurrency: true }, () => {
  const harness = createScheduleHandlerHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("emitUrlRequestBatchEvent", () => {
    it("calls messageBrokerService.publishUrlFetchBatch with correct data", async () => {
      const ctx = harness.createContext();

      const data = {
        rateSeconds: 600,
        data: [
          { url: "https://example.com/feed1.xml" },
          { url: "https://example.com/feed2.xml" },
        ],
      };

      await ctx.service.emitUrlRequestBatchEvent(data);

      assert.strictEqual(
        ctx.messageBrokerService.publishUrlFetchBatch.mock.callCount(),
        1,
      );
      const callArgs =
        ctx.messageBrokerService.publishUrlFetchBatch.mock.calls[0]?.arguments;
      assert.ok(callArgs);
      assert.deepStrictEqual(callArgs[0], data);
    });
  });

  describe("handleRefreshRate", () => {
    it("does not return duplicate URLs", async () => {
      const ctx = harness.createContext();
      const sharedUrl = `https://example.com/${ctx.generateId()}.xml`;

      await ctx.createFeedWithConnection({
        url: sharedUrl,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      await ctx.createFeedWithConnection({
        url: sharedUrl,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      const collectedUrls: string[] = [];

      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedUrls.push(item.url);
          }
        },
      });

      const uniqueUrls = [...new Set(collectedUrls)];
      assert.strictEqual(
        collectedUrls.length,
        uniqueUrls.length,
        "URLs should be unique",
      );
      assert.ok(collectedUrls.includes(sharedUrl));
    });

    it("calls the handlers in batches of 25 items", async () => {
      const ctx = harness.createContext();

      for (let i = 0; i < 30; i++) {
        await ctx.createFeedWithConnection({
          url: `https://example.com/feed-${ctx.generateId()}.xml`,
          refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        });
      }

      const batchSizes: number[] = [];

      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          batchSizes.push(batch.length);
        },
      });

      assert.ok(batchSizes.length >= 2, "Should have multiple batches");
      for (let i = 0; i < batchSizes.length - 1; i++) {
        assert.strictEqual(
          batchSizes[i],
          25,
          `Batch ${i} should have 25 items`,
        );
      }
    });

    it("excludes feeds with lookup keys from batched URL query", async () => {
      const ctx = harness.createContext();

      const feedWithoutLookupKey = await ctx.createFeedWithConnection({
        url: `https://example.com/regular-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      const feedWithLookupKey = await ctx.createFeedWithConnection({
        url: `https://example.com/lookup-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        feedRequestLookupKey: "some-lookup-key",
      });

      const collectedUrls: string[] = [];

      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedUrls.push(item.url);
          }
        },
      });

      assert.ok(
        collectedUrls.includes(feedWithoutLookupKey.url),
        "Should include feed without lookup key",
      );
      assert.ok(
        !collectedUrls.includes(feedWithLookupKey.url),
        "Should exclude feed with lookup key from regular batched query",
      );
    });

    it("processes feeds with lookup keys when user has Reddit credentials", async () => {
      const encryptionKey = generateEncryptionKey();
      const uniqueRefreshRate = 7200;
      const ctx = harness.createContext({ encryptionKey });
      const lookupKey = `lookup-${ctx.generateId()}`;
      const redditUrl = `https://reddit.com/r/test/${ctx.generateId()}.rss`;

      await ctx.createUserWithRedditCredentials(
        ctx.discordUserId,
        "test-access-token",
      );

      const feed = await ctx.createFeedWithConnection({
        url: redditUrl,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        userRefreshRateSeconds: uniqueRefreshRate,
        feedRequestLookupKey: lookupKey,
      });

      const slotWindow = {
        windowStartMs: 0,
        windowEndMs: uniqueRefreshRate * 1000,
        wrapsAroundInterval: false,
        refreshRateMs: uniqueRefreshRate * 1000,
      };

      const repoResults: Array<{
        url: string;
        feedRequestLookupKey?: string;
        users: Array<{
          externalCredentials?: Array<{ type: string; data?: unknown }>;
        }>;
      }> = [];
      for await (const item of ctx.userFeedRepository.iterateFeedsWithLookupKeysForRefreshRate(
        uniqueRefreshRate,
        slotWindow,
      )) {
        repoResults.push(item);
      }

      const repoMatch = repoResults.find((r) => r.url === feed.url);
      assert.ok(
        repoMatch,
        `Repository should find feed. Found ${repoResults.length} results.`,
      );
      assert.ok(
        repoMatch.users.length > 0,
        `User should be joined. Users: ${JSON.stringify(repoMatch.users)}`,
      );
      const creds = repoMatch.users[0]?.externalCredentials;
      assert.ok(
        creds?.length,
        `User should have credentials. Creds: ${JSON.stringify(creds)}`,
      );
      const redditCred = creds?.find(
        (c: { type: string }) => c.type === "reddit",
      );
      assert.ok(
        redditCred,
        `Should have reddit credential. Found types: ${creds?.map((c: { type: string }) => c.type).join(", ")}`,
      );
      const credData = redditCred as { type: string; data?: unknown };
      assert.ok(
        credData.data,
        `Credential should have data. Got: ${JSON.stringify(credData)}`,
      );
      const dataObj = credData.data as Record<string, string>;
      assert.ok(
        dataObj.accessToken,
        `Data should have accessToken. Got: ${JSON.stringify(dataObj)}`,
      );

      const collectedItems: Array<{
        url: string;
        lookupKey?: string;
      }> = [];

      await ctx.service.handleRefreshRate(uniqueRefreshRate, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedItems.push(item);
          }
        },
      });

      const matchingItem = collectedItems.find(
        (item) => item.lookupKey === lookupKey,
      );
      assert.ok(matchingItem, "Should find feed with lookup key in results");
      assert.ok(
        matchingItem.url.includes("oauth.reddit.com"),
        "URL should be transformed to OAuth Reddit URL",
      );
    });

    it("skips feeds with lookup keys when user has no Reddit credentials", async () => {
      const encryptionKey = generateEncryptionKey();
      const uniqueRefreshRate = 7800;
      const ctx = harness.createContext({ encryptionKey });
      const lookupKey = `lookup-${ctx.generateId()}`;
      const redditUrl = `https://reddit.com/r/test/${ctx.generateId()}.rss`;

      await ctx.createFeedWithConnection({
        url: redditUrl,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        userRefreshRateSeconds: uniqueRefreshRate,
        feedRequestLookupKey: lookupKey,
      });

      const collectedItems: Array<{
        url: string;
        lookupKey?: string;
      }> = [];

      await ctx.service.handleRefreshRate(uniqueRefreshRate, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedItems.push(item);
          }
        },
      });

      const matchingItem = collectedItems.find(
        (item) => item.lookupKey === lookupKey,
      );
      assert.ok(
        !matchingItem,
        "Should not find feed with lookup key when user has no credentials",
      );
    });

    it("filters lookup key feeds by refresh rate", async () => {
      const encryptionKey = generateEncryptionKey();
      const uniqueRefreshRate = 8400;
      const ctx = harness.createContext({ encryptionKey });
      const lookupKey1 = `lookup-1-${ctx.generateId()}`;
      const lookupKey2 = `lookup-2-${ctx.generateId()}`;

      await ctx.createUserWithRedditCredentials(
        ctx.discordUserId,
        "test-access-token",
      );

      await ctx.createFeedWithConnection({
        url: `https://reddit.com/r/test1/${ctx.generateId()}.rss`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        userRefreshRateSeconds: uniqueRefreshRate,
        feedRequestLookupKey: lookupKey1,
      });

      await ctx.createFeedWithConnection({
        url: `https://reddit.com/r/test2/${ctx.generateId()}.rss`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        userRefreshRateSeconds: uniqueRefreshRate * 2,
        feedRequestLookupKey: lookupKey2,
      });

      const collectedItems: Array<{
        url: string;
        lookupKey?: string;
      }> = [];

      await ctx.service.handleRefreshRate(uniqueRefreshRate, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedItems.push(item);
          }
        },
      });

      const matchingItem = collectedItems.find(
        (item) => item.lookupKey === lookupKey1,
      );
      assert.ok(matchingItem, "Should find feed matching refresh rate");

      const nonMatchingItem = collectedItems.find(
        (item) => item.lookupKey === lookupKey2,
      );
      assert.ok(
        !nonMatchingItem,
        "Should not find feed with different refresh rate",
      );
    });

    it("includes feeds matching the refresh rate", async () => {
      const ctx = harness.createContext();

      const matchingFeed = await ctx.createFeedWithConnection({
        url: `https://example.com/matching-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      await ctx.createFeedWithConnection({
        url: `https://example.com/non-matching-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS * 2,
      });

      const collectedUrls: string[] = [];

      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedUrls.push(item.url);
          }
        },
      });

      assert.ok(
        collectedUrls.includes(matchingFeed.url),
        "Should include matching feed",
      );
    });

    it("uses userRefreshRateSeconds when set instead of refreshRateSeconds", async () => {
      const ctx = harness.createContext();

      const feedWithUserRate = await ctx.createFeedWithConnection({
        url: `https://example.com/user-rate-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        userRefreshRateSeconds: SUPPORTER_REFRESH_RATE,
      });

      const collectedUrlsForDefault: string[] = [];
      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedUrlsForDefault.push(item.url);
          }
        },
      });

      assert.ok(
        !collectedUrlsForDefault.includes(feedWithUserRate.url),
        "Should not include feed in default rate query when userRefreshRateSeconds is set",
      );

      const collectedUrlsForSupporter: string[] = [];
      await ctx.service.handleRefreshRate(SUPPORTER_REFRESH_RATE, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedUrlsForSupporter.push(item.url);
          }
        },
      });

      assert.ok(
        collectedUrlsForSupporter.includes(feedWithUserRate.url),
        "Should include feed in supporter rate query",
      );
    });

    it("excludes disabled feeds", async () => {
      const ctx = harness.createContext();

      const enabledFeed = await ctx.createFeedWithConnection({
        url: `https://example.com/enabled-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      const disabledFeed = await ctx.createFeedWithConnection({
        url: `https://example.com/disabled-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      await ctx.setFields(disabledFeed.id, { disabledCode: "manual" });

      const collectedUrls: string[] = [];
      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedUrls.push(item.url);
          }
        },
      });

      assert.ok(
        collectedUrls.includes(enabledFeed.url),
        "Should include enabled feed",
      );
      assert.ok(
        !collectedUrls.includes(disabledFeed.url),
        "Should exclude disabled feed",
      );
    });

    it("excludes feeds without connections", async () => {
      const ctx = harness.createContext();

      const feedWithConnection = await ctx.createFeedWithConnection({
        url: `https://example.com/with-conn-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      const feedWithoutConnection = await ctx.createFeed({
        url: `https://example.com/no-conn-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      const collectedUrls: string[] = [];
      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedUrls.push(item.url);
          }
        },
      });

      assert.ok(
        collectedUrls.includes(feedWithConnection.url),
        "Should include feed with connection",
      );
      assert.ok(
        !collectedUrls.includes(feedWithoutConnection.url),
        "Should exclude feed without connection",
      );
    });
  });

  describe("getValidDiscordUserSupporters", () => {
    it("returns only supporters with isSupporter true", async () => {
      const ctx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: "supporter1",
              maxUserFeeds: 10,
              maxDailyArticles: 500,
              refreshRateSeconds: 120,
              isSupporter: true,
            },
            {
              discordUserId: "nonSupporter1",
              maxUserFeeds: 5,
              maxDailyArticles: 100,
              refreshRateSeconds: 600,
              isSupporter: false,
            },
            {
              discordUserId: "supporter2",
              maxUserFeeds: 10,
              maxDailyArticles: 500,
              refreshRateSeconds: 60,
              isSupporter: true,
            },
          ],
        },
      });

      const result = await ctx.service.getValidDiscordUserSupporters();

      assert.strictEqual(result.length, 2);
      assert.ok(result.some((s) => s.discordUserId === "supporter1"));
      assert.ok(result.some((s) => s.discordUserId === "supporter2"));
      assert.ok(!result.some((s) => s.discordUserId === "nonSupporter1"));
    });

    it("returns empty array when no supporters", async () => {
      const ctx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: "nonSupporter1",
              maxUserFeeds: 5,
              maxDailyArticles: 100,
              refreshRateSeconds: 600,
              isSupporter: false,
            },
          ],
        },
      });

      const result = await ctx.service.getValidDiscordUserSupporters();

      assert.strictEqual(result.length, 0);
    });
  });

  describe("runMaintenanceOperations", { concurrency: false }, () => {
    it("updates feed refresh rates based on supporter benefits", async () => {
      const ctx = harness.createContext();
      const supporterDiscordUserId = ctx.generateId();

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: supporterDiscordUserId,
              maxUserFeeds: 10,
              maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
              refreshRateSeconds: SUPPORTER_REFRESH_RATE,
              isSupporter: true,
            },
          ],
        },
      });

      const feed = await localCtx.createFeedWithConnection({
        discordUserId: supporterDiscordUserId,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed = await localCtx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.refreshRateSeconds,
        SUPPORTER_REFRESH_RATE,
      );
    });

    it("updates feed maxDailyArticles based on supporter benefits", async () => {
      const ctx = harness.createContext();
      const supporterDiscordUserId = ctx.generateId();

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: supporterDiscordUserId,
              maxUserFeeds: 10,
              maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
              refreshRateSeconds: SUPPORTER_REFRESH_RATE,
              isSupporter: true,
            },
          ],
        },
      });

      const feed = await localCtx.createFeedWithConnection({
        discordUserId: supporterDiscordUserId,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      await localCtx.setFields(feed.id, {
        maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed = await localCtx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.maxDailyArticles,
        SUPPORTER_MAX_DAILY_ARTICLES,
      );
    });

    it("resets non-supporter feeds to default refresh rate", async () => {
      const ctx = harness.createContext();
      const nonSupporterDiscordUserId = ctx.generateId();

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: nonSupporterDiscordUserId,
              maxUserFeeds: 5,
              maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
              refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
              isSupporter: false,
            },
          ],
        },
      });

      const feed = await localCtx.createFeedWithConnection({
        discordUserId: nonSupporterDiscordUserId,
        refreshRateSeconds: SUPPORTER_REFRESH_RATE,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed = await localCtx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.refreshRateSeconds,
        DEFAULT_REFRESH_RATE_SECONDS,
      );
    });

    it("calls usersService.syncLookupKeys", async () => {
      const ctx = harness.createContext({
        supportersService: {
          allUserBenefits: [],
        },
      });

      await ctx.service.runMaintenanceOperations();

      assert.strictEqual(ctx.usersService.syncLookupKeys.mock.callCount(), 1);
    });

    it("correctly updates feeds for multiple supporters with different refresh rates", async () => {
      const user1Id = `user1-${Date.now()}`;
      const user2Id = `user2-${Date.now()}`;
      const user3Id = `user3-${Date.now()}`;

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: user1Id,
              maxUserFeeds: 10,
              maxDailyArticles: 500,
              refreshRateSeconds: 120,
              isSupporter: true,
            },
            {
              discordUserId: user2Id,
              maxUserFeeds: 10,
              maxDailyArticles: 500,
              refreshRateSeconds: 120,
              isSupporter: true,
            },
            {
              discordUserId: user3Id,
              maxUserFeeds: 10,
              maxDailyArticles: 500,
              refreshRateSeconds: 60,
              isSupporter: true,
            },
          ],
        },
      });

      const feed1 = await localCtx.createFeedWithConnection({
        discordUserId: user1Id,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      const feed2 = await localCtx.createFeedWithConnection({
        discordUserId: user2Id,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      const feed3 = await localCtx.createFeedWithConnection({
        discordUserId: user3Id,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed1 = await localCtx.findById(feed1.id);
      const updatedFeed2 = await localCtx.findById(feed2.id);
      const updatedFeed3 = await localCtx.findById(feed3.id);

      assert.strictEqual(updatedFeed1?.refreshRateSeconds, 120);
      assert.strictEqual(updatedFeed2?.refreshRateSeconds, 120);
      assert.strictEqual(updatedFeed3?.refreshRateSeconds, 60);
    });

    it("correctly updates feeds for multiple supporters with different max daily articles", async () => {
      const user1Id = `user1-${Date.now()}`;
      const user2Id = `user2-${Date.now()}`;
      const user3Id = `user3-${Date.now()}`;

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: user1Id,
              maxUserFeeds: 10,
              maxDailyArticles: 500,
              refreshRateSeconds: 120,
              isSupporter: true,
            },
            {
              discordUserId: user2Id,
              maxUserFeeds: 10,
              maxDailyArticles: 500,
              refreshRateSeconds: 120,
              isSupporter: true,
            },
            {
              discordUserId: user3Id,
              maxUserFeeds: 10,
              maxDailyArticles: 1000,
              refreshRateSeconds: 120,
              isSupporter: true,
            },
          ],
        },
      });

      const feed1 = await localCtx.createFeedWithConnection({
        discordUserId: user1Id,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      await localCtx.setFields(feed1.id, {
        maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
      });

      const feed2 = await localCtx.createFeedWithConnection({
        discordUserId: user2Id,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      await localCtx.setFields(feed2.id, {
        maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
      });

      const feed3 = await localCtx.createFeedWithConnection({
        discordUserId: user3Id,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      await localCtx.setFields(feed3.id, {
        maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed1 = await localCtx.findById(feed1.id);
      const updatedFeed2 = await localCtx.findById(feed2.id);
      const updatedFeed3 = await localCtx.findById(feed3.id);

      assert.strictEqual(updatedFeed1?.maxDailyArticles, 500);
      assert.strictEqual(updatedFeed2?.maxDailyArticles, 500);
      assert.strictEqual(updatedFeed3?.maxDailyArticles, 1000);
    });

    it("resets non-supporter feeds to default max daily articles", async () => {
      const nonSupporterDiscordUserId = `nonsupporter-${Date.now()}`;

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: nonSupporterDiscordUserId,
              maxUserFeeds: 5,
              maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
              refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
              isSupporter: false,
            },
          ],
        },
      });

      const feed = await localCtx.createFeedWithConnection({
        discordUserId: nonSupporterDiscordUserId,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      await localCtx.setFields(feed.id, {
        maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed = await localCtx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.maxDailyArticles,
        DEFAULT_MAX_DAILY_ARTICLES,
      );
    });

    it("does not modify feed already at correct refresh rate", async () => {
      const supporterDiscordUserId = `supporter-${Date.now()}`;

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: supporterDiscordUserId,
              maxUserFeeds: 10,
              maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
              refreshRateSeconds: SUPPORTER_REFRESH_RATE,
              isSupporter: true,
            },
          ],
        },
      });

      const feed = await localCtx.createFeedWithConnection({
        discordUserId: supporterDiscordUserId,
        refreshRateSeconds: SUPPORTER_REFRESH_RATE,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed = await localCtx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.refreshRateSeconds,
        SUPPORTER_REFRESH_RATE,
      );
    });

    it("does not modify feed already at correct max daily articles", async () => {
      const supporterDiscordUserId = `supporter-${Date.now()}`;

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: supporterDiscordUserId,
              maxUserFeeds: 10,
              maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
              refreshRateSeconds: SUPPORTER_REFRESH_RATE,
              isSupporter: true,
            },
          ],
        },
      });

      const feed = await localCtx.createFeedWithConnection({
        discordUserId: supporterDiscordUserId,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      await localCtx.setFields(feed.id, {
        maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed = await localCtx.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.maxDailyArticles,
        SUPPORTER_MAX_DAILY_ARTICLES,
      );
    });

    it("updates multiple feeds for the same supporter", async () => {
      const supporterDiscordUserId = `supporter-${Date.now()}`;

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: supporterDiscordUserId,
              maxUserFeeds: 10,
              maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
              refreshRateSeconds: SUPPORTER_REFRESH_RATE,
              isSupporter: true,
            },
          ],
        },
      });

      const feed1 = await localCtx.createFeedWithConnection({
        discordUserId: supporterDiscordUserId,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      const feed2 = await localCtx.createFeedWithConnection({
        discordUserId: supporterDiscordUserId,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed1 = await localCtx.findById(feed1.id);
      const updatedFeed2 = await localCtx.findById(feed2.id);

      assert.strictEqual(
        updatedFeed1?.refreshRateSeconds,
        SUPPORTER_REFRESH_RATE,
      );
      assert.strictEqual(
        updatedFeed2?.refreshRateSeconds,
        SUPPORTER_REFRESH_RATE,
      );
    });

    it("handles supporter who upgrades to faster refresh rate", async () => {
      const supporterDiscordUserId = `supporter-${Date.now()}`;

      const localCtx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: supporterDiscordUserId,
              maxUserFeeds: 10,
              maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
              refreshRateSeconds: 60,
              isSupporter: true,
            },
          ],
        },
      });

      const feed = await localCtx.createFeedWithConnection({
        discordUserId: supporterDiscordUserId,
        refreshRateSeconds: 120,
      });

      await localCtx.service.runMaintenanceOperations();

      const updatedFeed = await localCtx.findById(feed.id);
      assert.strictEqual(updatedFeed?.refreshRateSeconds, 60);
    });

    describe("slot offset recalculation", () => {
      it("recalculates slotOffsetMs when supporter refresh rate changes", async () => {
        const supporterDiscordUserId = `supporter-${Date.now()}`;

        const localCtx = harness.createContext({
          supportersService: {
            allUserBenefits: [
              {
                discordUserId: supporterDiscordUserId,
                maxUserFeeds: 10,
                maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
                refreshRateSeconds: SUPPORTER_REFRESH_RATE,
                isSupporter: true,
              },
            ],
          },
        });

        const feed = await localCtx.createFeedWithConnection({
          discordUserId: supporterDiscordUserId,
          refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
          slotOffsetMs: 99999,
        });

        await localCtx.service.runMaintenanceOperations();

        const updatedFeed = await localCtx.findById(feed.id);
        assert.notStrictEqual(updatedFeed?.slotOffsetMs, 99999);
        assert.ok(
          typeof updatedFeed?.slotOffsetMs === "number",
          "slotOffsetMs should be updated",
        );
      });

      it("uses userRefreshRateSeconds when recalculating slot offset", async () => {
        const supporterDiscordUserId = `supporter-${Date.now()}`;

        const localCtx = harness.createContext({
          supportersService: {
            allUserBenefits: [
              {
                discordUserId: supporterDiscordUserId,
                maxUserFeeds: 10,
                maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
                refreshRateSeconds: SUPPORTER_REFRESH_RATE,
                isSupporter: true,
              },
            ],
          },
        });

        const feed = await localCtx.createFeedWithConnection({
          discordUserId: supporterDiscordUserId,
          refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
          userRefreshRateSeconds: 60,
          slotOffsetMs: 99999,
        });

        await localCtx.service.runMaintenanceOperations();

        const updatedFeed = await localCtx.findById(feed.id);
        assert.notStrictEqual(updatedFeed?.slotOffsetMs, 99999);
      });

      it("uses new supporter refresh rate for slot offset when userRefreshRateSeconds not set", async () => {
        const supporterDiscordUserId = `supporter-${Date.now()}`;

        const localCtx = harness.createContext({
          supportersService: {
            allUserBenefits: [
              {
                discordUserId: supporterDiscordUserId,
                maxUserFeeds: 10,
                maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
                refreshRateSeconds: SUPPORTER_REFRESH_RATE,
                isSupporter: true,
              },
            ],
          },
        });

        const feed = await localCtx.createFeedWithConnection({
          discordUserId: supporterDiscordUserId,
          refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
          slotOffsetMs: 99999,
        });

        await localCtx.service.runMaintenanceOperations();

        const updatedFeed = await localCtx.findById(feed.id);
        assert.notStrictEqual(updatedFeed?.slotOffsetMs, 99999);
        assert.ok(typeof updatedFeed?.slotOffsetMs === "number");
      });

      it("does not recalculate slotOffsetMs for feeds not affected by rate change", async () => {
        const supporterDiscordUserId = `supporter-${Date.now()}`;
        const otherDiscordUserId = `other-${Date.now()}`;

        const localCtx = harness.createContext({
          supportersService: {
            allUserBenefits: [
              {
                discordUserId: supporterDiscordUserId,
                maxUserFeeds: 10,
                maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
                refreshRateSeconds: SUPPORTER_REFRESH_RATE,
                isSupporter: true,
              },
            ],
          },
        });

        const feedNotMatching = await localCtx.createFeedWithConnection({
          discordUserId: otherDiscordUserId,
          refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
          slotOffsetMs: 88888,
        });

        await localCtx.service.runMaintenanceOperations();

        const updatedFeed = await localCtx.findById(feedNotMatching.id);
        assert.strictEqual(updatedFeed?.slotOffsetMs, 88888);
      });

      it("recalculates slotOffsetMs when non-supporter feed resets to default rate", async () => {
        const nonSupporterDiscordUserId = `nonsupporter-${Date.now()}`;

        const localCtx = harness.createContext({
          supportersService: {
            allUserBenefits: [
              {
                discordUserId: nonSupporterDiscordUserId,
                maxUserFeeds: 5,
                maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
                refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
                isSupporter: false,
              },
            ],
          },
        });

        const feed = await localCtx.createFeedWithConnection({
          discordUserId: nonSupporterDiscordUserId,
          refreshRateSeconds: SUPPORTER_REFRESH_RATE,
          slotOffsetMs: 99999,
        });

        await localCtx.service.runMaintenanceOperations();

        const updatedFeed = await localCtx.findById(feed.id);
        assert.strictEqual(
          updatedFeed?.refreshRateSeconds,
          DEFAULT_REFRESH_RATE_SECONDS,
        );
        assert.notStrictEqual(updatedFeed?.slotOffsetMs, 99999);
      });
    });
  });

  describe("enforceUserFeedLimits", () => {
    it("passes correctly mapped benefits to userFeedsService", async () => {
      const ctx = harness.createContext({
        supportersService: {
          allUserBenefits: [
            {
              discordUserId: "user1",
              maxUserFeeds: 10,
              maxDailyArticles: 500,
              refreshRateSeconds: 120,
              isSupporter: true,
            },
            {
              discordUserId: "user2",
              maxUserFeeds: 5,
              maxDailyArticles: 100,
              refreshRateSeconds: 600,
              isSupporter: false,
            },
          ],
        },
      });

      await ctx.service.enforceUserFeedLimits();

      assert.strictEqual(
        ctx.userFeedsService.enforceAllUserFeedLimits.mock.callCount(),
        1,
      );
      const callArgs =
        ctx.userFeedsService.enforceAllUserFeedLimits.mock.calls[0]?.arguments;
      assert.ok(callArgs);
      assert.deepStrictEqual(callArgs[0], [
        { discordUserId: "user1", maxUserFeeds: 10, refreshRateSeconds: 120 },
        { discordUserId: "user2", maxUserFeeds: 5, refreshRateSeconds: 600 },
      ]);
    });

    it("handles empty benefits array", async () => {
      const ctx = harness.createContext({
        supportersService: {
          allUserBenefits: [],
        },
      });

      await ctx.service.enforceUserFeedLimits();

      assert.strictEqual(
        ctx.userFeedsService.enforceAllUserFeedLimits.mock.callCount(),
        1,
      );
      const callArgs =
        ctx.userFeedsService.enforceAllUserFeedLimits.mock.calls[0]?.arguments;
      assert.ok(callArgs);
      assert.deepStrictEqual(callArgs[0], []);
    });
  });

  describe("handleRefreshRate - debug feeds", () => {
    it("sets saveToObjectStorage true for debug feeds", async () => {
      const ctx = harness.createContext();

      const debugFeed = await ctx.createFeedWithConnection({
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        debug: true,
      });

      const collectedItems: Array<{
        url: string;
        saveToObjectStorage?: boolean;
      }> = [];

      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedItems.push(item);
          }
        },
      });

      const matchingItem = collectedItems.find(
        (item) => item.url === debugFeed.url,
      );
      assert.ok(matchingItem, "Should find debug feed in batch");
      assert.strictEqual(
        matchingItem.saveToObjectStorage,
        true,
        "saveToObjectStorage should be true for debug feeds",
      );
    });

    it("does not set saveToObjectStorage for non-debug feeds", async () => {
      const ctx = harness.createContext();

      const normalFeed = await ctx.createFeedWithConnection({
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        debug: false,
      });

      const collectedItems: Array<{
        url: string;
        saveToObjectStorage?: boolean;
      }> = [];

      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedItems.push(item);
          }
        },
      });

      const matchingItem = collectedItems.find(
        (item) => item.url === normalFeed.url,
      );
      assert.ok(matchingItem, "Should find normal feed in batch");
      assert.strictEqual(
        matchingItem.saveToObjectStorage,
        false,
        "saveToObjectStorage should be false for non-debug feeds",
      );
    });
  });
});
