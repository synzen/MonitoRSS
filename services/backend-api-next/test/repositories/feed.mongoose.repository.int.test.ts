import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createFeedRepositoryHarness } from "../helpers/feed.repository.int.harness";

describe("FeedMongooseRepository Integration", { concurrency: true }, () => {
  const harness = createFeedRepositoryHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("aggregateWithFailRecords", { concurrency: true }, () => {
    it("returns feeds sorted by addedAt descending", async () => {
      const ctx = harness.createContext();

      await ctx.createFeed({ title: "Feed 2020", addedAt: new Date("2020-01-01") });
      await ctx.createFeed({ title: "Feed 2022", addedAt: new Date("2022-01-01") });
      await ctx.createFeed({ title: "Feed 2019", addedAt: new Date("2019-01-01") });
      await ctx.createFeed({ title: "Feed 2021", addedAt: new Date("2021-01-01") });

      const feeds = await ctx.repository.aggregateWithFailRecords({
        guildId: ctx.guildId,
        skip: 0,
        limit: 10,
      });

      const titles = feeds.map((f) => f.title);
      assert.deepStrictEqual(titles, ["Feed 2022", "Feed 2021", "Feed 2020", "Feed 2019"]);
    });

    it("respects limit and offset (skip)", async () => {
      const ctx = harness.createContext();

      await ctx.createFeed({ title: "Feed 2022", addedAt: new Date("2022-01-01") });
      await ctx.createFeed({ title: "Feed 2021", addedAt: new Date("2021-01-01") });
      await ctx.createFeed({ title: "Feed 2020", addedAt: new Date("2020-01-01") });
      await ctx.createFeed({ title: "Feed 2019", addedAt: new Date("2019-01-01") });

      const feeds = await ctx.repository.aggregateWithFailRecords({
        guildId: ctx.guildId,
        skip: 1,
        limit: 2,
      });

      const titles = feeds.map((f) => f.title);
      assert.deepStrictEqual(titles, ["Feed 2021", "Feed 2020"]);
    });

    it("filters by guild", async () => {
      const ctx1 = harness.createContext();
      const ctx2 = harness.createContext();

      await ctx1.createFeed({ title: "Guild 1 Feed" });
      await ctx2.createFeed({ title: "Guild 2 Feed" });

      const feeds = await ctx1.repository.aggregateWithFailRecords({
        guildId: ctx1.guildId,
        skip: 0,
        limit: 10,
      });

      assert.strictEqual(feeds.length, 1);
      assert.strictEqual(feeds[0]!.title, "Guild 1 Feed");
    });

    it("searches by title (case insensitive)", async () => {
      const ctx = harness.createContext();

      await ctx.createFeed({ title: "Google News", url: "https://news.google.com" });
      await ctx.createFeed({ title: "Yahoo Finance", url: "https://finance.yahoo.com" });

      const feeds = await ctx.repository.aggregateWithFailRecords({
        guildId: ctx.guildId,
        search: "google",
        skip: 0,
        limit: 10,
      });

      assert.strictEqual(feeds.length, 1);
      assert.strictEqual(feeds[0]!.title, "Google News");
    });

    it("searches by URL (case insensitive)", async () => {
      const ctx = harness.createContext();

      await ctx.createFeed({ title: "Some Feed", url: "https://google.com/feed" });
      await ctx.createFeed({ title: "Other Feed", url: "https://yahoo.com/feed" });

      const feeds = await ctx.repository.aggregateWithFailRecords({
        guildId: ctx.guildId,
        search: "GOOGLE",
        skip: 0,
        limit: 10,
      });

      assert.strictEqual(feeds.length, 1);
      assert.strictEqual(feeds[0]!.url, "https://google.com/feed");
    });
  });

  describe("countByGuild", { concurrency: true }, () => {
    it("returns correct count for guild", async () => {
      const ctx1 = harness.createContext();
      const ctx2 = harness.createContext();

      await ctx1.createFeed({ title: "Feed 1" });
      await ctx1.createFeed({ title: "Feed 2" });
      await ctx2.createFeed({ title: "Feed 3" });

      const count = await ctx1.repository.countByGuild(ctx1.guildId);

      assert.strictEqual(count, 2);
    });

    it("returns correct count with search filter", async () => {
      const ctx = harness.createContext();

      await ctx.createFeed({ title: "google news", url: "https://other.com" });
      await ctx.createFeed({ title: "yahoo news", url: "https://other.com/2" });
      await ctx.createFeed({ title: "other", url: "https://google.com/feed" });
      await ctx.createFeed({ title: "bing", url: "https://bing.com" });

      const count = await ctx.repository.countByGuild(ctx.guildId, "goo");

      assert.strictEqual(count, 2);
    });
  });
});
