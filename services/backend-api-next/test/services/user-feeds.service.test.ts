import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { UserFeedDisabledCode } from "../../src/repositories/shared/enums";
import { GetArticlesResponseRequestStatus } from "../../src/services/feed-handler/types";
import {
  FeedLimitReachedException,
  SourceFeedNotFoundException,
} from "../../src/shared/exceptions/user-feeds.exceptions";
import { createUserFeedsHarness } from "../helpers/user-feeds.harness";

const TEST_MAX_USER_FEEDS = 5;
const TEST_REFRESH_RATE_SECONDS = 600;
const TEST_MAX_DAILY_ARTICLES = 100;

describe("UserFeedsService", { concurrency: true }, () => {
  const harness = createUserFeedsHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("getFeedById", () => {
    it("returns feed when found", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({ title: "Test Feed" });

      const result = await ctx.service.getFeedById(feed.id);

      assert.ok(result);
      assert.strictEqual(result.id, feed.id);
      assert.strictEqual(result.title, "Test Feed");
    });

    it("returns null when not found", async () => {
      const ctx = harness.createContext();
      const fakeId = ctx.generateId();

      const result = await ctx.service.getFeedById(fakeId);

      assert.strictEqual(result, null);
    });
  });

  describe("calculateCurrentFeedCountOfDiscordUser", () => {
    it("counts feeds owned by user", async () => {
      const ctx = harness.createContext();
      await ctx.createMany(2);

      const count = await ctx.service.calculateCurrentFeedCountOfDiscordUser(
        ctx.discordUserId
      );

      assert.strictEqual(count, 2);
    });

    it("includes feeds with accepted invites", async () => {
      const ctx = harness.createContext();
      const ownerId = ctx.generateId();

      await ctx.createFeed({ title: "Owned Feed" });
      await ctx.createSharedFeed(ownerId);

      const count = await ctx.service.calculateCurrentFeedCountOfDiscordUser(
        ctx.discordUserId
      );

      assert.strictEqual(count, 2);
    });
  });

  describe("deduplicateFeedUrls", () => {
    it("removes URLs that user already has", async () => {
      const ctx = harness.createContext();
      const existingUrl = `https://example.com/${ctx.generateId()}.xml`;

      await ctx.createFeed({ url: existingUrl });

      const result = await ctx.service.deduplicateFeedUrls(ctx.discordUserId, [
        existingUrl,
        "https://example.com/new.xml",
      ]);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], "https://example.com/new.xml");
    });

    it("returns all URLs if none exist", async () => {
      const ctx = harness.createContext();

      const result = await ctx.service.deduplicateFeedUrls(ctx.discordUserId, [
        "https://example.com/1.xml",
        "https://example.com/2.xml",
      ]);

      assert.strictEqual(result.length, 2);
    });
  });

  describe("deleteFeedById", () => {
    it("deletes feed and returns deleted document", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({ title: "To Delete" });

      const result = await ctx.service.deleteFeedById(feed.id);

      assert.ok(result);
      assert.strictEqual(result.id, feed.id);

      const found = await ctx.findById(feed.id);
      assert.strictEqual(found, null);
    });

    it("returns null when feed not found", async () => {
      const ctx = harness.createContext();
      const fakeId = ctx.generateId();

      const result = await ctx.service.deleteFeedById(fakeId);

      assert.strictEqual(result, null);
    });
  });

  describe("bulkDelete", () => {
    it("deletes multiple feeds and returns status", async () => {
      const ctx = harness.createContext();
      const feed1 = await ctx.createFeed({ title: "Feed 1" });
      const feed2 = await ctx.createFeed({ title: "Feed 2" });
      const fakeId = ctx.generateId();

      const result = await ctx.service.bulkDelete([feed1.id, feed2.id, fakeId]);

      assert.strictEqual(result.length, 3);
      assert.ok(result.find((r) => r.id === feed1.id)?.deleted);
      assert.ok(result.find((r) => r.id === feed2.id)?.deleted);
      assert.ok(!result.find((r) => r.id === fakeId)?.deleted);
    });
  });

  describe("bulkDisable", () => {
    it("disables multiple feeds", async () => {
      const ctx = harness.createContext();
      const feed1 = await ctx.createFeed({ title: "Feed 1" });
      const feed2 = await ctx.createFeed({ title: "Feed 2" });

      const result = await ctx.service.bulkDisable([feed1.id, feed2.id]);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find((r) => r.id === feed1.id)?.disabled);
      assert.ok(result.find((r) => r.id === feed2.id)?.disabled);

      const updated1 = await ctx.findById(feed1.id);
      const updated2 = await ctx.findById(feed2.id);
      assert.strictEqual(updated1?.disabledCode, UserFeedDisabledCode.Manual);
      assert.strictEqual(updated2?.disabledCode, UserFeedDisabledCode.Manual);
    });

    it("skips already disabled feeds with non-manual code", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});
      await ctx.setDisabledCode(feed.id, UserFeedDisabledCode.BadFormat);

      const result = await ctx.service.bulkDisable([feed.id]);

      assert.strictEqual(result.length, 1);
      assert.ok(!result[0]!.disabled);
    });
  });

  describe("bulkEnable", () => {
    it("enables multiple manually disabled feeds", async () => {
      const ctx = harness.createContext();
      const feed1 = await ctx.createFeed({ title: "Feed 1" });
      const feed2 = await ctx.createFeed({ title: "Feed 2" });

      await ctx.setDisabledCode(feed1.id, UserFeedDisabledCode.Manual);
      await ctx.setDisabledCode(feed2.id, UserFeedDisabledCode.Manual);

      const result = await ctx.service.bulkEnable([feed1.id, feed2.id]);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find((r) => r.id === feed1.id)?.enabled);
      assert.ok(result.find((r) => r.id === feed2.id)?.enabled);

      const updated1 = await ctx.findById(feed1.id);
      const updated2 = await ctx.findById(feed2.id);
      assert.strictEqual(updated1?.disabledCode, undefined);
      assert.strictEqual(updated2?.disabledCode, undefined);
    });

    it("does not enable feeds disabled for other reasons", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});
      await ctx.setDisabledCode(feed.id, UserFeedDisabledCode.BadFormat);

      const result = await ctx.service.bulkEnable([feed.id]);

      assert.strictEqual(result.length, 1);
      assert.ok(!result[0]!.enabled);

      const updated = await ctx.findById(feed.id);
      assert.strictEqual(updated?.disabledCode, UserFeedDisabledCode.BadFormat);
    });
  });

  describe("getFeedsByUser", () => {
    it("returns feeds for user with pagination", async () => {
      const ctx = harness.createContext();
      await ctx.createMany(3);

      const result = await ctx.service.getFeedsByUser(
        ctx.userId,
        ctx.discordUserId,
        { limit: 2, offset: 0 }
      );

      assert.strictEqual(result.length, 2);
    });

    it("returns feeds sorted by createdAt descending by default", async () => {
      const ctx = harness.createContext();

      const feed1 = await ctx.createFeed({ title: "Older Feed" });
      await new Promise((r) => setTimeout(r, 10));
      const feed2 = await ctx.createFeed({ title: "Newer Feed" });

      const result = await ctx.service.getFeedsByUser(
        ctx.userId,
        ctx.discordUserId,
        { limit: 10, offset: 0 }
      );

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0]!.id, feed2.id);
      assert.strictEqual(result[1]!.id, feed1.id);
    });

    it("includes feeds shared with user", async () => {
      const ctx = harness.createContext();
      const ownerId = ctx.generateId();

      await ctx.createFeed({ title: "Owned Feed" });
      await ctx.createSharedFeed(ownerId);

      const result = await ctx.service.getFeedsByUser(
        ctx.userId,
        ctx.discordUserId,
        { limit: 10, offset: 0 }
      );

      assert.strictEqual(result.length, 2);
    });
  });

  describe("getFeedCountByUser", () => {
    it("counts feeds for user", async () => {
      const ctx = harness.createContext();
      await ctx.createMany(2);

      const count = await ctx.service.getFeedCountByUser(
        ctx.userId,
        ctx.discordUserId,
        {}
      );

      assert.strictEqual(count, 2);
    });
  });

  describe("addFeed", () => {
    it("creates a new feed with correct properties", async () => {
      const ctx = harness.createContext({
        feedHandler: {
          url: "https://example.com/feed.xml",
          articles: [{ date: new Date().toISOString() }],
          feedTitle: "Test Feed Title",
        },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/feed.xml" }
      );

      assert.ok(result);
      assert.strictEqual(result.url, "https://example.com/feed.xml");
      assert.strictEqual(result.user.discordUserId, ctx.discordUserId);
      assert.strictEqual(result.refreshRateSeconds, TEST_REFRESH_RATE_SECONDS);
      assert.strictEqual(result.maxDailyArticles, TEST_MAX_DAILY_ARTICLES);
      assert.ok(typeof result.slotOffsetMs === "number");
    });

    it("saves feedRequestLookupKey when creating a feed", async () => {
      const ctx = harness.createContext({
        feedHandler: { url: "https://example.com/feed.xml" },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/feed.xml" }
      );

      assert.ok(result.feedRequestLookupKey);
    });

    it("throws FeedLimitReachedException when user has reached max feeds", async () => {
      const ctx = harness.createContext({
        feedHandler: { url: "https://example.com/feed.xml" },
      });

      await ctx.createMany(TEST_MAX_USER_FEEDS);

      await assert.rejects(
        () =>
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://example.com/new.xml" }
          ),
        FeedLimitReachedException
      );
    });

    it("copies settings from source feed when sourceFeedId is provided", async () => {
      const ctx = harness.createContext({
        feedHandler: { url: "https://example.com/new.xml", feedTitle: "New Feed" },
      });

      const sourceFeed = await ctx.createFeed({ title: "Source Feed" });
      await ctx.setFields(sourceFeed.id, {
        passingComparisons: ["title", "description"],
        blockingComparisons: ["author"],
        formatOptions: { dateFormat: "YYYY-MM-DD" },
        dateCheckOptions: { oldArticleDateDiffMsThreshold: 86400000 },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/new.xml", sourceFeedId: sourceFeed.id }
      );

      assert.deepStrictEqual(result.passingComparisons, ["title", "description"]);
      assert.deepStrictEqual(result.blockingComparisons, ["author"]);
      assert.strictEqual(result.formatOptions?.dateFormat, "YYYY-MM-DD");
      assert.strictEqual(
        result.dateCheckOptions?.oldArticleDateDiffMsThreshold,
        86400000
      );
    });

    it("throws SourceFeedNotFoundException when sourceFeedId not found", async () => {
      const ctx = harness.createContext({
        feedHandler: { url: "https://example.com/feed.xml" },
      });

      const fakeSourceId = ctx.generateId();

      await assert.rejects(
        () =>
          ctx.service.addFeed(
            { discordUserId: ctx.discordUserId, userAccessToken: "token" },
            { url: "https://example.com/new.xml", sourceFeedId: fakeSourceId }
          ),
        SourceFeedNotFoundException
      );
    });

    it("sets dateCheckOptions when feed has articles with dates", async () => {
      const ctx = harness.createContext({
        feedHandler: {
          url: "https://example.com/feed.xml",
          articles: [{ date: new Date().toISOString() }],
          feedTitle: "Feed with dates",
        },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: "https://example.com/feed.xml" }
      );

      assert.ok(result.dateCheckOptions?.oldArticleDateDiffMsThreshold);
    });

    it("sets inputUrl when URL resolves to different final URL", async () => {
      const inputUrl = "https://example.com/page.html";
      const resolvedUrl = "https://example.com/feed.xml";

      const ctx = harness.createContext({
        feedHandler: { url: resolvedUrl, feedTitle: "Resolved Feed" },
      });

      const result = await ctx.service.addFeed(
        { discordUserId: ctx.discordUserId, userAccessToken: "token" },
        { url: inputUrl }
      );

      assert.strictEqual(result.url, resolvedUrl);
      assert.strictEqual(result.inputUrl, inputUrl);
    });
  });

  describe("updateFeedById", () => {
    it("updates feed title", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({ title: "Original Title" });

      const result = await ctx.service.updateFeedById(
        { id: feed.id, discordUserId: ctx.discordUserId },
        { title: "New Title" }
      );

      assert.ok(result);
      assert.strictEqual(result.title, "New Title");
    });

    it("updates passingComparisons", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id, discordUserId: ctx.discordUserId },
        { passingComparisons: ["title", "description"] }
      );

      assert.ok(result);
      assert.deepStrictEqual(result.passingComparisons, ["title", "description"]);
    });

    it("updates blockingComparisons", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id, discordUserId: ctx.discordUserId },
        { blockingComparisons: ["author"] }
      );

      assert.ok(result);
      assert.deepStrictEqual(result.blockingComparisons, ["author"]);
    });

    it("merges formatOptions with existing", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});
      await ctx.setFields(feed.id, {
        formatOptions: { dateFormat: "YYYY", dateTimezone: "UTC" },
      });

      const result = await ctx.service.updateFeedById(
        { id: feed.id, discordUserId: ctx.discordUserId },
        { formatOptions: { dateFormat: "MM-DD-YYYY" } }
      );

      assert.ok(result);
      assert.strictEqual(result.formatOptions?.dateFormat, "MM-DD-YYYY");
      assert.strictEqual(result.formatOptions?.dateTimezone, "UTC");
    });

    it("disables feed manually", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id, discordUserId: ctx.discordUserId },
        { disabledCode: UserFeedDisabledCode.Manual }
      );

      assert.ok(result);
      assert.strictEqual(result.disabledCode, UserFeedDisabledCode.Manual);
    });

    it("enables manually disabled feed", async () => {
      const ctx = harness.createContext();
      const feed = await ctx.createFeed({});
      await ctx.setDisabledCode(feed.id, UserFeedDisabledCode.Manual);

      const result = await ctx.service.updateFeedById(
        { id: feed.id, discordUserId: ctx.discordUserId },
        { disabledCode: null }
      );

      assert.ok(result);
      assert.strictEqual(result.disabledCode, undefined);
    });

    it("throws FeedLimitReachedException when enabling feed would exceed limit", async () => {
      const ctx = harness.createContext();

      await ctx.createMany(TEST_MAX_USER_FEEDS);
      const disabledFeed = await ctx.createDisabled(
        UserFeedDisabledCode.ExceededFeedLimit
      );

      await assert.rejects(
        () =>
          ctx.service.updateFeedById(
            { id: disabledFeed.id, discordUserId: ctx.discordUserId },
            { disabledCode: null }
          ),
        FeedLimitReachedException
      );
    });

    it("returns null when feed not found", async () => {
      const ctx = harness.createContext();
      const fakeId = ctx.generateId();

      const result = await ctx.service.updateFeedById(
        { id: fakeId, discordUserId: ctx.discordUserId },
        { title: "New Title" }
      );

      assert.strictEqual(result, null);
    });

    it("updates URL and recalculates slotOffsetMs", async () => {
      let publishedMessage: unknown = null;
      const ctx = harness.createContext({
        feedHandler: { url: "https://example.com/new.xml", feedTitle: "New Feed" },
        publishMessage: async (_queue, msg) => {
          publishedMessage = msg;
        },
      });

      const feed = await ctx.createFeed({});

      const result = await ctx.service.updateFeedById(
        { id: feed.id, discordUserId: ctx.discordUserId },
        { url: "https://example.com/new.xml" }
      );

      assert.ok(result);
      assert.strictEqual(result.url, "https://example.com/new.xml");
      assert.ok(typeof result.slotOffsetMs === "number");
      assert.ok(publishedMessage);
    });

    it("publishes feed-deleted message when URL changes", async () => {
      let publishedQueue: string | null = null;
      let publishedMessage: unknown = null;
      const ctx = harness.createContext({
        feedHandler: { url: "https://example.com/new.xml" },
        publishMessage: async (queue, msg) => {
          publishedQueue = queue;
          publishedMessage = msg;
        },
      });

      const feed = await ctx.createFeed({});

      await ctx.service.updateFeedById(
        { id: feed.id, discordUserId: ctx.discordUserId },
        { url: "https://example.com/new.xml" }
      );

      assert.strictEqual(publishedQueue, "feed-deleted");
      assert.deepStrictEqual(publishedMessage, {
        data: { feed: { id: feed.id } },
      });
    });
  });

  describe("validateFeedUrl", () => {
    it("returns resolved URL when different from input", async () => {
      const inputUrl = "https://example.com/page.html";
      const resolvedUrl = "https://example.com/feed.xml";

      const ctx = harness.createContext({
        feedHandler: { url: resolvedUrl, feedTitle: "Test Feed" },
      });

      const result = await ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url: inputUrl }
      );

      assert.strictEqual(result.resolvedToUrl, resolvedUrl);
    });

    it("returns null resolvedToUrl when URL is same as input", async () => {
      const url = "https://example.com/feed.xml";

      const ctx = harness.createContext({
        feedHandler: { url, feedTitle: "Test Feed" },
      });

      const result = await ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url }
      );

      assert.strictEqual(result.resolvedToUrl, null);
    });

    it("returns feedTitle when available", async () => {
      const ctx = harness.createContext({
        feedHandler: {
          url: "https://example.com/feed.xml",
          feedTitle: "My Awesome Feed",
        },
      });

      const result = await ctx.service.validateFeedUrl(
        { discordUserId: ctx.discordUserId },
        { url: "https://example.com/feed.xml" }
      );

      assert.strictEqual(result.feedTitle, "My Awesome Feed");
    });
  });

  describe("enforceUserFeedLimit", () => {
    it("re-enables feeds when user deletes feeds and is under limit", async () => {
      const ctx = harness.createContext();

      const feeds = await ctx.createMany(TEST_MAX_USER_FEEDS);
      const disabledFeed = await ctx.createDisabled(
        UserFeedDisabledCode.ExceededFeedLimit
      );

      await ctx.service.deleteFeedById(feeds[0]!.id);

      const updated = await ctx.findById(disabledFeed.id);
      assert.strictEqual(updated?.disabledCode, undefined);
    });
  });

  describe("error handling", () => {
    it("handles feedHandlerService failure gracefully", async () => {
      const ctx = harness.createContext({
        feedHandler: {
          requestStatus: GetArticlesResponseRequestStatus.BadStatusCode,
        },
      });

      await assert.rejects(() =>
        ctx.service.addFeed(
          { discordUserId: ctx.discordUserId, userAccessToken: "token" },
          { url: "https://invalid.com/feed.xml" }
        )
      );
    });

    it("rejects banned feeds", async () => {
      const ctx = harness.createContext({
        bannedFeedDetails: { reason: "spam" },
        feedHandler: { url: "https://banned.com/feed.xml" },
      });

      await assert.rejects(() =>
        ctx.service.addFeed(
          { discordUserId: ctx.discordUserId, userAccessToken: "token" },
          { url: "https://banned.com/feed.xml" }
        )
      );
    });

    it("throws error for invalid ObjectId format in getFeedById", async () => {
      const ctx = harness.createContext();

      await assert.rejects(() => ctx.service.getFeedById("not-a-valid-id"));
    });
  });
});
