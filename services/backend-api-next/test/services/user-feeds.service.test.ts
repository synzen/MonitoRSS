import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { UserFeedsService } from "../../src/services/user-feeds/user-feeds.service";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import {
  UserFeedDisabledCode,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import type { UserFeedsServiceDeps } from "../../src/services/user-feeds/types";

describe("UserFeedsService", () => {
  let connection: mongoose.Connection;
  let userFeedRepository: UserFeedMongooseRepository;
  let userRepository: UserMongooseRepository;
  let service: UserFeedsService;

  const createMockDeps = (
    overrides: Partial<UserFeedsServiceDeps> = {}
  ): UserFeedsServiceDeps => ({
    config: {} as UserFeedsServiceDeps["config"],
    userFeedRepository,
    userRepository,
    feedsService: {} as UserFeedsServiceDeps["feedsService"],
    supportersService: {
      getBenefitsOfDiscordUser: async () => ({
        maxUserFeeds: 5,
        maxDailyArticles: 100,
        refreshRateSeconds: 600,
      }),
    } as unknown as UserFeedsServiceDeps["supportersService"],
    feedFetcherApiService: {} as UserFeedsServiceDeps["feedFetcherApiService"],
    feedHandlerService: {} as UserFeedsServiceDeps["feedHandlerService"],
    usersService: {
      getOrCreateUserByDiscordId: async () => ({
        id: new mongoose.Types.ObjectId().toHexString(),
        discordUserId: "test-user",
      }),
    } as unknown as UserFeedsServiceDeps["usersService"],
    publishMessage: async () => {},
    ...overrides,
  });

  before(async () => {
    const uri = process.env.BACKEND_API_MONGODB_URI;
    if (!uri) {
      throw new Error("BACKEND_API_MONGODB_URI not set");
    }
    connection = await mongoose.createConnection(uri).asPromise();
    userFeedRepository = new UserFeedMongooseRepository(connection);
    userRepository = new UserMongooseRepository(connection);
  });

  after(async () => {
    await connection?.close();
  });

  beforeEach(async () => {
    await userFeedRepository.deleteAll();
    service = new UserFeedsService(createMockDeps());
  });

  describe("getFeedById", () => {
    it("returns feed when found", async () => {
      const feed = await userFeedRepository.create({
        title: "Test Feed",
        url: "https://example.com/feed.xml",
        user: { discordUserId: "123" },
      });

      const result = await service.getFeedById(feed.id);

      assert.ok(result);
      assert.strictEqual(result.id, feed.id);
      assert.strictEqual(result.title, "Test Feed");
    });

    it("returns null when not found", async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();
      const result = await service.getFeedById(fakeId);

      assert.strictEqual(result, null);
    });
  });

  describe("calculateCurrentFeedCountOfDiscordUser", () => {
    it("counts feeds owned by user", async () => {
      const discordUserId = "user-123";

      await userFeedRepository.create({
        title: "Feed 1",
        url: "https://example.com/1.xml",
        user: { discordUserId },
      });
      await userFeedRepository.create({
        title: "Feed 2",
        url: "https://example.com/2.xml",
        user: { discordUserId },
      });

      const count =
        await service.calculateCurrentFeedCountOfDiscordUser(discordUserId);

      assert.strictEqual(count, 2);
    });

    it("includes feeds with accepted invites", async () => {
      const discordUserId = "user-123";
      const ownerId = "owner-456";

      await userFeedRepository.create({
        title: "Owned Feed",
        url: "https://example.com/owned.xml",
        user: { discordUserId },
      });
      await userFeedRepository.create({
        title: "Shared Feed",
        url: "https://example.com/shared.xml",
        user: { discordUserId: ownerId },
        shareManageOptions: {
          invites: [
            { discordUserId, status: UserFeedManagerStatus.Accepted },
          ],
        },
      });

      const count =
        await service.calculateCurrentFeedCountOfDiscordUser(discordUserId);

      assert.strictEqual(count, 2);
    });
  });

  describe("deduplicateFeedUrls", () => {
    it("removes URLs that user already has", async () => {
      const discordUserId = "user-123";
      const existingUrl = "https://example.com/existing.xml";

      await userFeedRepository.create({
        title: "Existing Feed",
        url: existingUrl,
        user: { discordUserId },
      });

      const result = await service.deduplicateFeedUrls(discordUserId, [
        existingUrl,
        "https://example.com/new.xml",
      ]);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], "https://example.com/new.xml");
    });

    it("returns all URLs if none exist", async () => {
      const result = await service.deduplicateFeedUrls("user-123", [
        "https://example.com/1.xml",
        "https://example.com/2.xml",
      ]);

      assert.strictEqual(result.length, 2);
    });
  });

  describe("deleteFeedById", () => {
    it("deletes feed and returns deleted document", async () => {
      const feed = await userFeedRepository.create({
        title: "To Delete",
        url: "https://example.com/feed.xml",
        user: { discordUserId: "123" },
      });

      const result = await service.deleteFeedById(feed.id);

      assert.ok(result);
      assert.strictEqual(result.id, feed.id);

      const found = await userFeedRepository.findById(feed.id);
      assert.strictEqual(found, null);
    });

    it("returns null when feed not found", async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();
      const result = await service.deleteFeedById(fakeId);

      assert.strictEqual(result, null);
    });
  });

  describe("bulkDelete", () => {
    it("deletes multiple feeds and returns status", async () => {
      const feed1 = await userFeedRepository.create({
        title: "Feed 1",
        url: "https://example.com/1.xml",
        user: { discordUserId: "123" },
      });
      const feed2 = await userFeedRepository.create({
        title: "Feed 2",
        url: "https://example.com/2.xml",
        user: { discordUserId: "123" },
      });
      const fakeId = new mongoose.Types.ObjectId().toHexString();

      const result = await service.bulkDelete([feed1.id, feed2.id, fakeId]);

      assert.strictEqual(result.length, 3);
      assert.ok(result.find((r) => r.id === feed1.id)?.deleted);
      assert.ok(result.find((r) => r.id === feed2.id)?.deleted);
      assert.ok(!result.find((r) => r.id === fakeId)?.deleted);
    });
  });

  describe("bulkDisable", () => {
    it("disables multiple feeds", async () => {
      const feed1 = await userFeedRepository.create({
        title: "Feed 1",
        url: "https://example.com/1.xml",
        user: { discordUserId: "123" },
      });
      const feed2 = await userFeedRepository.create({
        title: "Feed 2",
        url: "https://example.com/2.xml",
        user: { discordUserId: "123" },
      });

      const result = await service.bulkDisable([feed1.id, feed2.id]);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find((r) => r.id === feed1.id)?.disabled);
      assert.ok(result.find((r) => r.id === feed2.id)?.disabled);

      const updated1 = await userFeedRepository.findById(feed1.id);
      const updated2 = await userFeedRepository.findById(feed2.id);
      assert.strictEqual(updated1?.disabledCode, UserFeedDisabledCode.Manual);
      assert.strictEqual(updated2?.disabledCode, UserFeedDisabledCode.Manual);
    });

    it("skips already disabled feeds with non-manual code", async () => {
      const feed = await userFeedRepository.create({
        title: "Feed",
        url: "https://example.com/feed.xml",
        user: { discordUserId: "123" },
      });
      await userFeedRepository.updateById(feed.id, {
        $set: { disabledCode: UserFeedDisabledCode.BadFormat },
      });

      const result = await service.bulkDisable([feed.id]);

      assert.strictEqual(result.length, 1);
      assert.ok(!result[0].disabled);
    });
  });

  describe("bulkEnable", () => {
    it("enables multiple manually disabled feeds", async () => {
      const feed1 = await userFeedRepository.create({
        title: "Feed 1",
        url: "https://example.com/1.xml",
        user: { discordUserId: "123" },
      });
      const feed2 = await userFeedRepository.create({
        title: "Feed 2",
        url: "https://example.com/2.xml",
        user: { discordUserId: "123" },
      });

      await userFeedRepository.updateById(feed1.id, {
        $set: { disabledCode: UserFeedDisabledCode.Manual },
      });
      await userFeedRepository.updateById(feed2.id, {
        $set: { disabledCode: UserFeedDisabledCode.Manual },
      });

      const result = await service.bulkEnable([feed1.id, feed2.id]);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find((r) => r.id === feed1.id)?.enabled);
      assert.ok(result.find((r) => r.id === feed2.id)?.enabled);

      const updated1 = await userFeedRepository.findById(feed1.id);
      const updated2 = await userFeedRepository.findById(feed2.id);
      assert.strictEqual(updated1?.disabledCode, undefined);
      assert.strictEqual(updated2?.disabledCode, undefined);
    });

    it("does not enable feeds disabled for other reasons", async () => {
      const feed = await userFeedRepository.create({
        title: "Feed",
        url: "https://example.com/feed.xml",
        user: { discordUserId: "123" },
      });
      await userFeedRepository.updateById(feed.id, {
        $set: { disabledCode: UserFeedDisabledCode.BadFormat },
      });

      const result = await service.bulkEnable([feed.id]);

      assert.strictEqual(result.length, 1);
      assert.ok(!result[0].enabled);

      const updated = await userFeedRepository.findById(feed.id);
      assert.strictEqual(updated?.disabledCode, UserFeedDisabledCode.BadFormat);
    });
  });

  describe("getFeedsByUser", () => {
    it("returns feeds for user with pagination", async () => {
      const discordUserId = "user-123";
      const userId = new mongoose.Types.ObjectId().toHexString();

      await userFeedRepository.create({
        title: "Feed 1",
        url: "https://example.com/1.xml",
        user: { discordUserId },
      });
      await userFeedRepository.create({
        title: "Feed 2",
        url: "https://example.com/2.xml",
        user: { discordUserId },
      });
      await userFeedRepository.create({
        title: "Feed 3",
        url: "https://example.com/3.xml",
        user: { discordUserId },
      });

      const result = await service.getFeedsByUser(userId, discordUserId, {
        limit: 2,
        offset: 0,
      });

      assert.strictEqual(result.length, 2);
    });

    it("returns feeds sorted by createdAt descending by default", async () => {
      const discordUserId = "user-123";
      const userId = new mongoose.Types.ObjectId().toHexString();

      const feed1 = await userFeedRepository.create({
        title: "Older Feed",
        url: "https://example.com/1.xml",
        user: { discordUserId },
      });

      await new Promise((r) => setTimeout(r, 10));

      const feed2 = await userFeedRepository.create({
        title: "Newer Feed",
        url: "https://example.com/2.xml",
        user: { discordUserId },
      });

      const result = await service.getFeedsByUser(userId, discordUserId, {
        limit: 10,
        offset: 0,
      });

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].id, feed2.id);
      assert.strictEqual(result[1].id, feed1.id);
    });

    it("includes feeds shared with user", async () => {
      const discordUserId = "user-123";
      const ownerId = "owner-456";
      const userId = new mongoose.Types.ObjectId().toHexString();

      await userFeedRepository.create({
        title: "Owned Feed",
        url: "https://example.com/owned.xml",
        user: { discordUserId },
      });
      await userFeedRepository.create({
        title: "Shared Feed",
        url: "https://example.com/shared.xml",
        user: { discordUserId: ownerId },
        shareManageOptions: {
          invites: [
            { discordUserId, status: UserFeedManagerStatus.Accepted },
          ],
        },
      });

      const result = await service.getFeedsByUser(userId, discordUserId, {
        limit: 10,
        offset: 0,
      });

      assert.strictEqual(result.length, 2);
    });
  });

  describe("getFeedCountByUser", () => {
    it("counts feeds for user", async () => {
      const discordUserId = "user-123";
      const userId = new mongoose.Types.ObjectId().toHexString();

      await userFeedRepository.create({
        title: "Feed 1",
        url: "https://example.com/1.xml",
        user: { discordUserId },
      });
      await userFeedRepository.create({
        title: "Feed 2",
        url: "https://example.com/2.xml",
        user: { discordUserId },
      });

      const count = await service.getFeedCountByUser(userId, discordUserId, {});

      assert.strictEqual(count, 2);
    });
  });
});
