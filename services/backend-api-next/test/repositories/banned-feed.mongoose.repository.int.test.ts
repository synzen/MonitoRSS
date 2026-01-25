import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert";
import type { Connection } from "mongoose";
import {
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/setup-test-database";
import { BannedFeedMongooseRepository } from "../../src/repositories/mongoose/banned-feed.mongoose.repository";

describe("BannedFeedMongooseRepository Integration", { concurrency: false }, () => {
  let mongoConnection: Connection;
  let repository: BannedFeedMongooseRepository;

  before(async () => {
    mongoConnection = await setupTestDatabase();
    repository = new BannedFeedMongooseRepository(mongoConnection);
  });

  afterEach(async () => {
    await repository.deleteAll();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("findByUrlForGuild", () => {
    it("returns null when no banned feed exists", async () => {
      const result = await repository.findByUrlForGuild(
        "https://example.com/feed",
        "guild-1"
      );

      assert.strictEqual(result, null);
    });

    it("returns null when URL does not match", async () => {
      await repository.create({
        url: "https://other-url.com/feed",
        guildIds: [],
      });

      const result = await repository.findByUrlForGuild(
        "https://example.com/feed",
        "guild-1"
      );

      assert.strictEqual(result, null);
    });

    it("returns null when banned feed exists for different guild", async () => {
      await repository.create({
        url: "https://example.com/feed",
        guildIds: ["guild-123"],
      });

      const result = await repository.findByUrlForGuild(
        "https://example.com/feed",
        "guild-456"
      );

      assert.strictEqual(result, null);
    });

    it("returns banned feed when URL matches and guildIds includes the guild", async () => {
      await repository.create({
        url: "https://reddit.com/r/test",
        reason: "spam source",
        guildIds: ["guild-1", "guild-2"],
      });

      const result = await repository.findByUrlForGuild(
        "https://reddit.com/r/test",
        "guild-1"
      );

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.url, "https://reddit.com/r/test");
      assert.strictEqual(result?.reason, "spam source");
    });

    it("returns banned feed when guildIds is empty (global ban)", async () => {
      await repository.create({
        url: "https://malicious-site.com/feed",
        reason: "malware distribution",
        guildIds: [],
      });

      const result = await repository.findByUrlForGuild(
        "https://malicious-site.com/feed",
        "any-guild-id"
      );

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.url, "https://malicious-site.com/feed");
      assert.strictEqual(result?.reason, "malware distribution");
    });

    it("returns guild-specific ban over global ban when both exist", async () => {
      await repository.create({
        url: "https://example.com/feed",
        reason: "global reason",
        guildIds: [],
      });

      await repository.create({
        url: "https://example.com/feed",
        reason: "guild-specific reason",
        guildIds: ["guild-1"],
      });

      const result = await repository.findByUrlForGuild(
        "https://example.com/feed",
        "guild-1"
      );

      assert.notStrictEqual(result, null);
    });
  });
});
