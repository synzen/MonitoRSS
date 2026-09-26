import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createScheduleHandlerHarness,
  generateEncryptionKey,
} from "../helpers/schedule-handler.harness";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../../src/repositories/shared/enums";
import { fnv1aHash } from "../../src/shared/utils/fnv1a-hash";
import { SCHEDULED_BATCH_RATE_SECONDS } from "../../src/shared/constants/scheduler.constants";

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

    it("processes workspace feeds with lookup keys using the workspace's Reddit credentials", async () => {
      const encryptionKey = generateEncryptionKey();
      const uniqueRefreshRate = 7300;
      const ctx = harness.createContext({ encryptionKey });
      const lookupKey = `lookup-${ctx.generateId()}`;
      const redditUrl = `https://reddit.com/r/test/${ctx.generateId()}.rss`;

      const workspaceId = await ctx.createWorkspace();
      await ctx.setWorkspaceRedditCredentials(
        workspaceId,
        "workspace-access-token",
      );

      await ctx.createFeedWithConnection({
        workspaceId,
        url: redditUrl,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        userRefreshRateSeconds: uniqueRefreshRate,
        feedRequestLookupKey: lookupKey,
      });

      const collectedItems: Array<{ url: string; lookupKey?: string }> = [];

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
        matchingItem,
        "Should find workspace feed with lookup key in results",
      );
      assert.ok(
        matchingItem.url.includes("oauth.reddit.com"),
        "URL should be transformed to OAuth Reddit URL using workspace credentials",
      );
    });

    it("skips workspace feeds with lookup keys when the creator has Reddit credentials but the workspace does not", async () => {
      // Fail-closed: a workspace feed resolves ONLY the workspace connection,
      // never falling back to the creator's personal credentials.
      const encryptionKey = generateEncryptionKey();
      const uniqueRefreshRate = 7400;
      const ctx = harness.createContext({ encryptionKey });
      const lookupKey = `lookup-${ctx.generateId()}`;
      const redditUrl = `https://reddit.com/r/test/${ctx.generateId()}.rss`;
      const creatorDiscordUserId = ctx.generateId();

      await ctx.createUserWithRedditCredentials(
        creatorDiscordUserId,
        "creator-access-token",
      );

      const workspaceId = await ctx.createWorkspace();

      await ctx.createFeedWithConnection({
        discordUserId: creatorDiscordUserId,
        workspaceId,
        url: redditUrl,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        userRefreshRateSeconds: uniqueRefreshRate,
        feedRequestLookupKey: lookupKey,
      });

      const collectedItems: Array<{ url: string; lookupKey?: string }> = [];

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
        "Workspace feed must not fall back to the creator's personal credentials",
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

    it("schedules marked recovery feeds with their recovery epoch", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeedWithConnection({
        url: `https://example.com/recovery-${ctx.generateId()}.xml`,
        refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      });
      const recoveryStartedAt = new Date(Date.now() - 1_000);
      await ctx.setFields(feed.id, {
        disabledCode: UserFeedDisabledCode.FailedRequests,
        healthStatus: UserFeedHealthStatus.Failing,
        recoveryStartedAt,
      });

      const scheduled: Array<{ url: string; recovery?: { startedAt: number } }> = [];
      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          scheduled.push(...batch);
        },
      });

      assert.deepStrictEqual(
        scheduled.find((item) => item.url === feed.url)?.recovery,
        { startedAt: recoveryStartedAt.getTime() },
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

    describe("workspace feeds", () => {
      it("updates workspace feed refresh rates from workspace benefits", async () => {
        const localCtx = harness.createContext();
        const workspaceId = await localCtx.createWorkspace();

        const restampedCtx = harness.createContext({
          supportersService: {
            workspaceBenefits: {
              [workspaceId]: {
                maxFeeds: 140,
                maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
                refreshRateSeconds: SUPPORTER_REFRESH_RATE,
                allowWebhooks: true,
              },
            },
          },
        });

        const feed = await restampedCtx.createFeedWithConnection({
          workspaceId,
          refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        });

        await restampedCtx.service.runMaintenanceOperations();

        const updatedFeed = await restampedCtx.findById(feed.id);
        assert.strictEqual(
          updatedFeed?.refreshRateSeconds,
          SUPPORTER_REFRESH_RATE,
        );
      });

      it("updates workspace feed maxDailyArticles from workspace benefits", async () => {
        const localCtx = harness.createContext();
        const workspaceId = await localCtx.createWorkspace();

        const restampedCtx = harness.createContext({
          supportersService: {
            workspaceBenefits: {
              [workspaceId]: {
                maxFeeds: 140,
                maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
                refreshRateSeconds: SUPPORTER_REFRESH_RATE,
                allowWebhooks: true,
              },
            },
          },
        });

        const feed = await restampedCtx.createFeedWithConnection({
          workspaceId,
          refreshRateSeconds: SUPPORTER_REFRESH_RATE,
        });
        await restampedCtx.setFields(feed.id, {
          maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
        });

        await restampedCtx.service.runMaintenanceOperations();

        const updatedFeed = await restampedCtx.findById(feed.id);
        assert.strictEqual(
          updatedFeed?.maxDailyArticles,
          SUPPORTER_MAX_DAILY_ARTICLES,
        );
      });

      it("resets a downgraded workspace's feeds to the default refresh rate", async () => {
        // Workspace previously had a subscription (feed stamped at the faster
        // supporter rate). With no override in workspaceBenefits, the mock
        // returns default benefits, simulating a lapsed/cancelled subscription.
        // Maintenance must re-stamp the stale fast rate back down to default.
        const localCtx = harness.createContext();
        const workspaceId = await localCtx.createWorkspace();

        const downgradedCtx = harness.createContext();

        const feed = await downgradedCtx.createFeedWithConnection({
          workspaceId,
          refreshRateSeconds: SUPPORTER_REFRESH_RATE,
        });

        await downgradedCtx.service.runMaintenanceOperations();

        const updatedFeed = await downgradedCtx.findById(feed.id);
        assert.strictEqual(
          updatedFeed?.refreshRateSeconds,
          DEFAULT_REFRESH_RATE_SECONDS,
        );
      });

      it("recalculates slotOffsetMs when a workspace's refresh rate changes", async () => {
        const localCtx = harness.createContext();
        const workspaceId = await localCtx.createWorkspace();

        const restampedCtx = harness.createContext({
          supportersService: {
            workspaceBenefits: {
              [workspaceId]: {
                maxFeeds: 140,
                maxDailyArticles: SUPPORTER_MAX_DAILY_ARTICLES,
                refreshRateSeconds: SUPPORTER_REFRESH_RATE,
                allowWebhooks: true,
              },
            },
          },
        });

        const feed = await restampedCtx.createFeedWithConnection({
          workspaceId,
          refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
          slotOffsetMs: 99999,
        });

        await restampedCtx.service.runMaintenanceOperations();

        const updatedFeed = await restampedCtx.findById(feed.id);
        assert.strictEqual(
          updatedFeed?.refreshRateSeconds,
          SUPPORTER_REFRESH_RATE,
        );
        assert.notStrictEqual(updatedFeed?.slotOffsetMs, 99999);
      });

      it("does not let personal supporter sync touch workspace feeds", async () => {
        // A workspace feed whose creator is a supporter must take the
        // workspace's rate, not the creator's personal supporter rate.
        const localCtx = harness.createContext();
        const workspaceId = await localCtx.createWorkspace();
        const supporterDiscordUserId = localCtx.generateId();

        const mixedCtx = harness.createContext({
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
            // workspaceBenefits intentionally omitted -> workspace is free tier.
          },
        });

        const feed = await mixedCtx.createFeedWithConnection({
          discordUserId: supporterDiscordUserId,
          workspaceId,
          refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
        });

        await mixedCtx.service.runMaintenanceOperations();

        const updatedFeed = await mixedCtx.findById(feed.id);
        assert.strictEqual(
          updatedFeed?.refreshRateSeconds,
          DEFAULT_REFRESH_RATE_SECONDS,
          "workspace feed must not inherit the creator's supporter rate",
        );
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

  describe("handleScheduledFeeds", () => {
    // The clock branch fires on wall-clock minutes, so the tests pin `now` to
    // a fixed UTC occurrence and pick URLs whose spreading slot matches the
    // tick being simulated (slot = hash(url) % ticks per minute).
    const OCCURRENCE = Date.parse("2026-09-26T21:00:00Z");
    const TICK_MS = 30_000;

    function urlWithSlot(slot: number, base: string): string {
      for (let i = 0; i < 1000; ++i) {
        const url = `https://example.com/${base}-${i}.xml`;

        if (fnv1aHash(url) % 2 === slot) {
          return url;
        }
      }

      throw new Error(`No url found for slot ${slot}`);
    }

    async function createScheduledFeed(
      ctx: ReturnType<ReturnType<typeof createScheduleHandlerHarness>["createContext"]>,
      input: {
        url?: string;
        times?: string[];
        timezone?: string;
        feedRequestLookupKey?: string;
        disabledCode?: string;
        lastScheduledFiredAt?: Date;
      },
    ) {
      const feed = await ctx.createFeedWithConnection({
        url: input.url,
        feedRequestLookupKey: input.feedRequestLookupKey,
      });
      const fields: Record<string, unknown> = {
        scheduleMode: "scheduled",
        schedule: {
          times: input.times ?? ["21:00"],
          timezone: input.timezone ?? "UTC",
        },
      };

      if (input.disabledCode) {
        fields.disabledCode = input.disabledCode;
      }

      if (input.lastScheduledFiredAt) {
        fields.lastScheduledFiredAt = input.lastScheduledFiredAt;
      }

      await ctx.setFields(feed.id, fields);

      return feed;
    }

    interface PublishedBatch {
      rateSeconds: number;
      data: Array<{
        url: string;
        lookupKey?: string;
        trigger?: { kind: string; occurredAt: number };
      }>;
    }

    function collectedBatches(ctx: {
      messageBrokerService: {
        publishUrlFetchBatch: {
          mock: { calls: Array<{ arguments: unknown[] }> };
        };
      };
    }): PublishedBatch[] {
      return ctx.messageBrokerService.publishUrlFetchBatch.mock.calls.map(
        (call) => call.arguments[0] as PublishedBatch,
      );
    }

    // Suites run concurrently against one shared database, and the clock
    // branch selects every scheduled feed in it — so tests assert only on the
    // feeds they created.
    function entriesForUrl(batches: PublishedBatch[], url: string) {
      return batches
        .flatMap((batch) => batch.data)
        .filter((item) => item.url === url);
    }

    it("emits a fetch batch stamped with the scheduled trigger for a feed due at its local minute", async () => {
      let nowMs = 0;
      const ctx = harness.createContext({ now: () => nowMs });
      const url = urlWithSlot(0, "scheduled-due");
      const feed = await createScheduledFeed(ctx, { url });

      nowMs = OCCURRENCE;
      await ctx.service.handleScheduledFeeds();

      const batches = collectedBatches(ctx);
      assert.ok(batches.length >= 1);
      assert.ok(
        batches.every(
          (batch) => batch.rateSeconds === SCHEDULED_BATCH_RATE_SECONDS,
        ),
      );
      const matching = batches
        .flatMap((batch) => batch.data)
        .find((item) => item.url === feed.url);
      assert.ok(matching, "due feed URL should be in the batch");
      assert.deepStrictEqual(matching.trigger, {
        kind: "scheduled",
        occurredAt: OCCURRENCE,
      });
    });

    it("does not emit fetches at other times of day", async () => {
      let nowMs = 0;
      const ctx = harness.createContext({ now: () => nowMs });
      const url = urlWithSlot(0, "scheduled-other-times");
      const feed = await createScheduledFeed(ctx, { url });

      nowMs = OCCURRENCE - 60 * 60 * 1000;
      await ctx.service.handleScheduledFeeds();

      nowMs = OCCURRENCE + 60 * 60 * 1000;
      await ctx.service.handleScheduledFeeds();

      assert.strictEqual(entriesForUrl(collectedBatches(ctx), feed.url).length, 0);
    });

    it("catches up a missed occurrence within the bound using the original occurrence time", async () => {
      let nowMs = 0;
      const ctx = harness.createContext({ now: () => nowMs });
      const url = urlWithSlot(0, "scheduled-catchup");
      const feed = await createScheduledFeed(ctx, { url });

      // Simulate the emitter being down at 21:00 and recovering 10 minutes later.
      nowMs = OCCURRENCE + 10 * 60 * 1000;
      await ctx.service.handleScheduledFeeds();

      const batches = collectedBatches(ctx);
      const matching = batches
        .flatMap((batch) => batch.data)
        .find((item) => item.url === feed.url);
      assert.ok(matching, "missed occurrence should fire on recovery");
      assert.deepStrictEqual(matching.trigger, {
        kind: "scheduled",
        occurredAt: OCCURRENCE,
      });
    });

    it("does not re-fire an occurrence already recorded as fired", async () => {
      let nowMs = 0;
      const ctx = harness.createContext({ now: () => nowMs });
      const url = urlWithSlot(0, "scheduled-fired");
      const feed = await createScheduledFeed(ctx, {
        url,
        lastScheduledFiredAt: new Date(OCCURRENCE),
      });

      nowMs = OCCURRENCE;
      await ctx.service.handleScheduledFeeds();

      assert.strictEqual(entriesForUrl(collectedBatches(ctx), feed.url).length, 0);
    });

    it("groups scheduled feeds sharing a URL into a single batch entry", async () => {
      let nowMs = 0;
      const ctx = harness.createContext({ now: () => nowMs });
      const sharedUrl = urlWithSlot(0, "scheduled-shared");
      await createScheduledFeed(ctx, { url: sharedUrl });
      await createScheduledFeed(ctx, { url: sharedUrl });
      await createScheduledFeed(ctx, { url: sharedUrl });

      nowMs = OCCURRENCE;
      await ctx.service.handleScheduledFeeds();

      const batches = collectedBatches(ctx);
      const entries = batches
        .flatMap((batch) => batch.data)
        .filter((item) => item.url === sharedUrl);
      assert.strictEqual(entries.length, 1);
    });

    it("excludes disabled scheduled feeds", async () => {
      let nowMs = 0;
      const ctx = harness.createContext({ now: () => nowMs });
      const disabledUrl = urlWithSlot(0, "scheduled-disabled");
      const feed = await createScheduledFeed(ctx, {
        url: disabledUrl,
        disabledCode: UserFeedDisabledCode.Manual,
      });

      nowMs = OCCURRENCE;
      await ctx.service.handleScheduledFeeds();

      assert.strictEqual(
        entriesForUrl(collectedBatches(ctx), feed.url).length,
        0,
      );
    });

    it("spreads due URLs across the minute's ticks", async () => {
      let nowMs = 0;
      const ctx = harness.createContext({ now: () => nowMs });
      const slot0Url = urlWithSlot(0, "spread-tick0");
      const slot1Url = urlWithSlot(1, "spread-tick1");
      const slot0Feed = await createScheduledFeed(ctx, { url: slot0Url });
      const slot1Feed = await createScheduledFeed(ctx, { url: slot1Url });

      nowMs = OCCURRENCE;
      await ctx.service.handleScheduledFeeds();

      nowMs = OCCURRENCE + TICK_MS;
      await ctx.service.handleScheduledFeeds();

      const batches = collectedBatches(ctx);
      const firstTickUrls = (batches[0]?.data ?? []).map((item) => item.url);
      const secondTickUrls = (batches[1]?.data ?? []).map((item) => item.url);

      assert.ok(
        firstTickUrls.includes(slot0Feed.url),
        "slot-0 URL fires on the first tick",
      );
      assert.ok(
        !firstTickUrls.includes(slot1Feed.url),
        "slot-1 URL must not fire on the first tick",
      );
      assert.ok(
        secondTickUrls.includes(slot1Feed.url),
        "slot-1 URL fires on the second tick",
      );
      assert.ok(
        !secondTickUrls.includes(slot0Feed.url),
        "slot-0 URL must not refire on the second tick",
      );
    });

    it("sub-batches a hot minute at 25 URLs per publish", async () => {
      let nowMs = 0;
      const ctx = harness.createContext({ now: () => nowMs });
      const createdUrls: string[] = [];

      for (let i = 0; i < 55; ++i) {
        const url = urlWithSlot(0, `hot-minute-${i}`);
        createdUrls.push(url);
        await createScheduledFeed(ctx, { url });
      }

      nowMs = OCCURRENCE;
      await ctx.service.handleScheduledFeeds();

      const batches = collectedBatches(ctx);
      const myEntries = createdUrls.flatMap((url) =>
        entriesForUrl(batches, url),
      );

      assert.strictEqual(myEntries.length, 55);
      for (const batch of batches) {
        assert.ok(
          batch.data.length <= 25,
          "no published batch may exceed 25 entries",
        );
      }
      assert.ok(
        batches.length >= 3,
        "55 due URLs require at least three batches",
      );
      assert.ok(
        batches.every((batch) => batch.rateSeconds === SCHEDULED_BATCH_RATE_SECONDS),
      );
    });

    it("resolves lookup-key scheduled feeds using user credentials", async () => {
      const encryptionKey = generateEncryptionKey();
      let nowMs = 0;
      const ctx = harness.createContext({ encryptionKey, now: () => nowMs });
      const lookupKey = `lookup-${ctx.generateId()}`;
      const redditUrl = `https://reddit.com/r/test/${ctx.generateId()}.rss`;

      await ctx.createUserWithRedditCredentials(
        ctx.discordUserId,
        "test-access-token",
      );

      const feed = await createScheduledFeed(ctx, {
        url: redditUrl,
        feedRequestLookupKey: lookupKey,
      });

      // The spreading slot is keyed by URL, so fire the tick this URL is
      // assigned to.
      nowMs = OCCURRENCE + (fnv1aHash(redditUrl) % 2) * TICK_MS;
      await ctx.service.handleScheduledFeeds();

      const batches = collectedBatches(ctx);
      const matching = batches
        .flatMap((batch) => batch.data)
        .find((item) => item.lookupKey === lookupKey);

      assert.ok(matching, "lookup-key feed should be scheduled");
      assert.ok(
        matching.url.includes("oauth.reddit.com"),
        "URL should be transformed to the OAuth Reddit URL",
      );
      assert.deepStrictEqual(matching.trigger, {
        kind: "scheduled",
        occurredAt: OCCURRENCE,
      });
      assert.notStrictEqual(matching.url, feed.url);
    });

    it("keeps scheduled feeds out of interval refresh-rate scheduling", async () => {
      const ctx = harness.createContext();
      const scheduledUrl = `https://example.com/scheduled-interval-${ctx.generateId()}.xml`;

      await createScheduledFeed(ctx, { url: scheduledUrl });

      const collectedUrls: string[] = [];
      await ctx.service.handleRefreshRate(DEFAULT_REFRESH_RATE_SECONDS, {
        urlsHandler: async (batch) => {
          for (const item of batch) {
            collectedUrls.push(item.url);
          }
        },
      });

      assert.ok(
        !collectedUrls.includes(scheduledUrl),
        "scheduled feeds must not be fetched by interval cycles",
      );
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
