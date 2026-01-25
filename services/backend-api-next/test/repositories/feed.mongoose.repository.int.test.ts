import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert";
import type { Connection } from "mongoose";
import {
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/setup-test-database";
import { FeedMongooseRepository } from "../../src/repositories/mongoose/feed.mongoose.repository";

describe("FeedMongooseRepository Integration", { concurrency: false }, () => {
  let mongoConnection: Connection;
  let repository: FeedMongooseRepository;

  before(async () => {
    mongoConnection = await setupTestDatabase();
    repository = new FeedMongooseRepository(mongoConnection);
  });

  afterEach(async () => {
    await repository.deleteAll();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("aggregateWithFailRecords", () => {
    it("returns feeds sorted by addedAt descending", async () => {
      const guildId = "guild-1";

      await repository.create({
        title: "Feed 2020",
        url: "https://example.com/2020",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2020-01-01"),
      });

      await repository.create({
        title: "Feed 2022",
        url: "https://example.com/2022",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2022-01-01"),
      });

      await repository.create({
        title: "Feed 2019",
        url: "https://example.com/2019",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2019-01-01"),
      });

      await repository.create({
        title: "Feed 2021",
        url: "https://example.com/2021",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2021-01-01"),
      });

      const feeds = await repository.aggregateWithFailRecords({
        guildId,
        skip: 0,
        limit: 10,
      });

      const titles = feeds.map((f) => f.title);
      assert.deepStrictEqual(titles, ["Feed 2022", "Feed 2021", "Feed 2020", "Feed 2019"]);
    });

    it("respects limit and offset (skip)", async () => {
      const guildId = "guild-1";

      await repository.create({
        title: "Feed 2022",
        url: "https://example.com/2022",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2022-01-01"),
      });

      await repository.create({
        title: "Feed 2021",
        url: "https://example.com/2021",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2021-01-01"),
      });

      await repository.create({
        title: "Feed 2020",
        url: "https://example.com/2020",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2020-01-01"),
      });

      await repository.create({
        title: "Feed 2019",
        url: "https://example.com/2019",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2019-01-01"),
      });

      const feeds = await repository.aggregateWithFailRecords({
        guildId,
        skip: 1,
        limit: 2,
      });

      const titles = feeds.map((f) => f.title);
      assert.deepStrictEqual(titles, ["Feed 2021", "Feed 2020"]);
    });

    it("filters by guild", async () => {
      await repository.create({
        title: "Guild 1 Feed",
        url: "https://example.com/g1",
        guild: "guild-1",
        channel: "channel-1",
        addedAt: new Date("2022-01-01"),
      });

      await repository.create({
        title: "Guild 2 Feed",
        url: "https://example.com/g2",
        guild: "guild-2",
        channel: "channel-1",
        addedAt: new Date("2022-01-01"),
      });

      const feeds = await repository.aggregateWithFailRecords({
        guildId: "guild-1",
        skip: 0,
        limit: 10,
      });

      assert.strictEqual(feeds.length, 1);
      assert.strictEqual(feeds[0].title, "Guild 1 Feed");
    });

    it("searches by title (case insensitive)", async () => {
      const guildId = "guild-1";

      await repository.create({
        title: "Google News",
        url: "https://news.google.com",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2022-01-01"),
      });

      await repository.create({
        title: "Yahoo Finance",
        url: "https://finance.yahoo.com",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2022-01-01"),
      });

      const feeds = await repository.aggregateWithFailRecords({
        guildId,
        search: "google",
        skip: 0,
        limit: 10,
      });

      assert.strictEqual(feeds.length, 1);
      assert.strictEqual(feeds[0].title, "Google News");
    });

    it("searches by URL (case insensitive)", async () => {
      const guildId = "guild-1";

      await repository.create({
        title: "Some Feed",
        url: "https://google.com/feed",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2022-01-01"),
      });

      await repository.create({
        title: "Other Feed",
        url: "https://yahoo.com/feed",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date("2022-01-01"),
      });

      const feeds = await repository.aggregateWithFailRecords({
        guildId,
        search: "GOOGLE",
        skip: 0,
        limit: 10,
      });

      assert.strictEqual(feeds.length, 1);
      assert.strictEqual(feeds[0].url, "https://google.com/feed");
    });
  });

  describe("countByGuild", () => {
    it("returns correct count for guild", async () => {
      await repository.create({
        title: "Feed 1",
        url: "https://example.com/1",
        guild: "guild-1",
        channel: "channel-1",
        addedAt: new Date(),
      });

      await repository.create({
        title: "Feed 2",
        url: "https://example.com/2",
        guild: "guild-1",
        channel: "channel-1",
        addedAt: new Date(),
      });

      await repository.create({
        title: "Feed 3",
        url: "https://example.com/3",
        guild: "guild-2",
        channel: "channel-1",
        addedAt: new Date(),
      });

      const count = await repository.countByGuild("guild-1");

      assert.strictEqual(count, 2);
    });

    it("returns correct count with search filter", async () => {
      const guildId = "guild-1";

      await repository.create({
        title: "google news",
        url: "https://other.com",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date(),
      });

      await repository.create({
        title: "yahoo news",
        url: "https://other.com/2",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date(),
      });

      await repository.create({
        title: "other",
        url: "https://google.com/feed",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date(),
      });

      await repository.create({
        title: "bing",
        url: "https://bing.com",
        guild: guildId,
        channel: "channel-1",
        addedAt: new Date(),
      });

      const count = await repository.countByGuild(guildId, "goo");

      assert.strictEqual(count, 2);
    });
  });
});
