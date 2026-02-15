import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import { randomUUID } from "crypto";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { CustomPlaceholderStepType } from "../../src/repositories/shared/enums";

describe("MongoMigrationsService Integration", { concurrency: false }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  beforeEach(async () => {
    const migrationModel = ctx.connection.model("MongoMigration");
    const userFeedModel = ctx.connection.model("UserFeed");
    const userModel = ctx.connection.model("User");
    await migrationModel.deleteMany({});
    await userFeedModel.deleteMany({});
    await userModel.deleteMany({});
  });

  after(async () => {
    await ctx.teardown();
  });

  describe("applyMigrations", () => {
    it("records migrations in database after applying", async () => {
      await ctx.container.mongoMigrationsService.applyMigrations();

      const migrations = await ctx.container.mongoMigrationRepository.find();

      assert.strictEqual(migrations.length, 4);

      const migrationIds = migrations.map((m) => m.migrationId).sort();
      assert.deepStrictEqual(migrationIds, [
        "add-user-ids-to-user-feeds",
        "backfill-slot-offset-ms",
        "convert-user-feed-user-ids-t-mongo-ids",
        "custom-placeholder-steps",
      ]);
    });

    it("does not re-apply migrations that are already recorded", async () => {
      await ctx.container.mongoMigrationsService.applyMigrations();

      const migrationsAfterFirst =
        await ctx.container.mongoMigrationRepository.find();
      const firstRunCount = migrationsAfterFirst.length;

      await ctx.container.mongoMigrationsService.applyMigrations();

      const migrationsAfterSecond =
        await ctx.container.mongoMigrationRepository.find();

      assert.strictEqual(migrationsAfterSecond.length, firstRunCount);
    });

    it("applies only unapplied migrations when some exist", async () => {
      const connection = ctx.connection;
      const migrationModel = connection.model("MongoMigration");
      await migrationModel.create({ id: "custom-placeholder-steps" });
      await migrationModel.create({ id: "add-user-ids-to-user-feeds" });

      await ctx.container.mongoMigrationsService.applyMigrations();

      const migrations = await ctx.container.mongoMigrationRepository.find();
      assert.strictEqual(migrations.length, 4);
    });
  });

  describe("backfill-slot-offset-ms migration", () => {
    it("calculates and sets slotOffsetMs for feeds missing it", async () => {
      const connection = ctx.connection;
      const migrationModel = connection.model("MongoMigration");
      await migrationModel.create({ id: "custom-placeholder-steps" });
      await migrationModel.create({ id: "add-user-ids-to-user-feeds" });
      await migrationModel.create({
        id: "convert-user-feed-user-ids-t-mongo-ids",
      });

      const userFeedModel = connection.model("UserFeed");
      await userFeedModel.create({
        title: "Test Feed 1",
        url: "https://example.com/feed1.xml",
        user: { discordUserId: "user1" },
        refreshRateSeconds: 600,
        healthStatus: "OK",
      });
      await userFeedModel.create({
        title: "Test Feed 2",
        url: "https://example.com/feed2.xml",
        user: { discordUserId: "user2" },
        userRefreshRateSeconds: 300,
        healthStatus: "OK",
      });

      await ctx.container.mongoMigrationsService.applyMigrations();

      const feeds = await userFeedModel.find({}).lean();

      for (const feed of feeds) {
        assert.ok(
          typeof feed.slotOffsetMs === "number",
          `Feed ${feed.title} should have slotOffsetMs set`,
        );
        assert.ok(
          feed.slotOffsetMs >= 0,
          `slotOffsetMs should be non-negative`,
        );
      }
    });

    it("does not modify feeds that already have slotOffsetMs", async () => {
      const connection = ctx.connection;
      const migrationModel = connection.model("MongoMigration");
      await migrationModel.create({ id: "custom-placeholder-steps" });
      await migrationModel.create({ id: "add-user-ids-to-user-feeds" });
      await migrationModel.create({
        id: "convert-user-feed-user-ids-t-mongo-ids",
      });

      const userFeedModel = connection.model("UserFeed");
      const existingSlotOffset = 12345;
      await userFeedModel.create({
        title: "Feed with existing slotOffset",
        url: "https://example.com/existing.xml",
        user: { discordUserId: "user1" },
        refreshRateSeconds: 600,
        slotOffsetMs: existingSlotOffset,
        healthStatus: "OK",
      });

      await ctx.container.mongoMigrationsService.applyMigrations();

      const feed = (await userFeedModel
        .findOne({ title: "Feed with existing slotOffset" })
        .lean()) as { slotOffsetMs?: number } | null;
      assert.strictEqual(feed?.slotOffsetMs, existingSlotOffset);
    });
  });

  describe("add-user-ids-to-user-feeds migration", () => {
    it("populates user.id from User collection when missing", async () => {
      const connection = ctx.connection;
      const migrationModel = connection.model("MongoMigration");
      await migrationModel.create({ id: "custom-placeholder-steps" });

      const userModel = connection.model("User");
      const user = await userModel.create({
        discordUserId: "discord-user-123",
      });

      const userFeedModel = connection.model("UserFeed");
      await userFeedModel.create({
        title: "Feed without user.id",
        url: "https://example.com/feed.xml",
        user: { discordUserId: "discord-user-123" },
        healthStatus: "OK",
      });

      await ctx.container.mongoMigrationsService.applyMigrations();

      const feed = (await userFeedModel
        .findOne({ title: "Feed without user.id" })
        .lean()) as { user?: { id?: { toString(): string } } } | null;

      assert.ok(feed?.user?.id, "user.id should be populated");
      assert.strictEqual(
        feed?.user?.id?.toString(),
        user._id.toString(),
        "user.id should match the User document's _id",
      );
    });

    it("skips feeds that already have user.id", async () => {
      const connection = ctx.connection;
      const migrationModel = connection.model("MongoMigration");
      await migrationModel.create({ id: "custom-placeholder-steps" });

      const existingUserId = new Types.ObjectId();
      const userFeedModel = connection.model("UserFeed");
      await userFeedModel.create({
        title: "Feed with existing user.id",
        url: "https://example.com/feed.xml",
        user: { id: existingUserId, discordUserId: "discord-user-456" },
        healthStatus: "OK",
      });

      await ctx.container.mongoMigrationsService.applyMigrations();

      const feed = (await userFeedModel
        .findOne({ title: "Feed with existing user.id" })
        .lean()) as { user?: { id?: { toString(): string } } } | null;

      assert.strictEqual(
        feed?.user?.id?.toString(),
        existingUserId.toString(),
        "existing user.id should not be changed",
      );
    });
  });

  describe("custom-placeholder-steps migration", () => {
    it("adds id and type fields to custom placeholder steps", async () => {
      const connection = ctx.connection;
      const userFeedModel = connection.model("UserFeed");

      const stepWithoutIdAndType = {
        regexSearch: "test",
        replacementString: "replaced",
      };

      await userFeedModel.collection.insertOne({
        title: "Feed with custom placeholders",
        url: "https://example.com/feed.xml",
        user: { discordUserId: "user1" },
        healthStatus: "OK",
        connections: {
          discordChannels: [
            {
              id: new Types.ObjectId(),
              name: "test-channel",
              details: {
                channel: { id: "channel1", guildId: "guild1" },
                embeds: [],
              },
              customPlaceholders: [
                {
                  id: randomUUID(),
                  referenceName: "placeholder1",
                  sourcePlaceholder: "title",
                  steps: [stepWithoutIdAndType],
                },
              ],
            },
          ],
        },
      });

      await ctx.container.mongoMigrationsService.applyMigrations();

      const feed = (await userFeedModel
        .findOne({ title: "Feed with custom placeholders" })
        .lean()) as { connections?: { discordChannels?: unknown[] } } | null;
      const channel = feed?.connections?.discordChannels?.[0] as {
        customPlaceholders?: Array<{
          steps: Array<{ id?: string; type?: string }>;
        }>;
      };
      const step = channel?.customPlaceholders?.[0]?.steps?.[0];

      assert.ok(step?.id, "step should have an id assigned");
      assert.strictEqual(
        step?.type,
        CustomPlaceholderStepType.Regex,
        "step should have type set to Regex",
      );
    });

    it("preserves existing type if already set", async () => {
      const connection = ctx.connection;
      const userFeedModel = connection.model("UserFeed");

      const stepWithType = {
        regexSearch: "test",
        replacementString: "replaced",
        type: CustomPlaceholderStepType.UrlEncode,
      };

      await userFeedModel.collection.insertOne({
        title: "Feed with typed step",
        url: "https://example.com/feed.xml",
        user: { discordUserId: "user1" },
        healthStatus: "OK",
        connections: {
          discordChannels: [
            {
              id: new Types.ObjectId(),
              name: "test-channel",
              details: {
                channel: { id: "channel1", guildId: "guild1" },
                embeds: [],
              },
              customPlaceholders: [
                {
                  id: randomUUID(),
                  referenceName: "placeholder1",
                  sourcePlaceholder: "title",
                  steps: [stepWithType],
                },
              ],
            },
          ],
        },
      });

      await ctx.container.mongoMigrationsService.applyMigrations();

      const feed = (await userFeedModel
        .findOne({ title: "Feed with typed step" })
        .lean()) as { connections?: { discordChannels?: unknown[] } } | null;
      const channel = feed?.connections?.discordChannels?.[0] as {
        customPlaceholders?: Array<{
          steps: Array<{ type?: string }>;
        }>;
      };
      const step = channel?.customPlaceholders?.[0]?.steps?.[0];

      assert.strictEqual(
        step?.type,
        CustomPlaceholderStepType.UrlEncode,
        "existing type should be preserved",
      );
    });
  });

  describe("convert-user-feed-user-ids-t-mongo-ids migration", () => {
    it("converts string user.id to ObjectId", async () => {
      const connection = ctx.connection;
      const migrationModel = connection.model("MongoMigration");
      await migrationModel.create({ id: "custom-placeholder-steps" });
      await migrationModel.create({ id: "add-user-ids-to-user-feeds" });

      const userFeedModel = connection.model("UserFeed");
      const stringUserId = new Types.ObjectId().toHexString();

      await userFeedModel.collection.insertOne({
        title: "Feed with string user.id",
        url: "https://example.com/feed.xml",
        user: { id: stringUserId, discordUserId: "discord-user-789" },
        healthStatus: "OK",
      });

      await ctx.container.mongoMigrationsService.applyMigrations();

      const rawDoc = await userFeedModel.collection.findOne({
        title: "Feed with string user.id",
      });
      const userId = rawDoc?.user?.id;

      assert.ok(
        typeof userId !== "string" && userId?.constructor?.name === "ObjectId",
        `user.id should be stored as ObjectId in database, got: ${typeof userId} (${userId?.constructor?.name})`,
      );
      assert.strictEqual(
        userId?.toHexString?.() ?? String(userId),
        stringUserId,
        "ObjectId value should match original string",
      );
    });

    it("handles user.id that is already an ObjectId without error", async () => {
      const connection = ctx.connection;
      const migrationModel = connection.model("MongoMigration");
      await migrationModel.create({ id: "custom-placeholder-steps" });
      await migrationModel.create({ id: "add-user-ids-to-user-feeds" });

      const userFeedModel = connection.model("UserFeed");
      const objectIdUserId = new Types.ObjectId();

      await userFeedModel.create({
        title: "Feed with ObjectId user.id",
        url: "https://example.com/feed.xml",
        user: { id: objectIdUserId, discordUserId: "discord-user-101" },
        healthStatus: "OK",
      });

      await assert.doesNotReject(
        async () => ctx.container.mongoMigrationsService.applyMigrations(),
        "should not throw when user.id is already an ObjectId",
      );

      const feed = (await userFeedModel
        .findOne({ title: "Feed with ObjectId user.id" })
        .lean()) as { user?: { id?: { toHexString(): string } } } | null;
      assert.strictEqual(
        feed?.user?.id?.toHexString(),
        objectIdUserId.toHexString(),
        "ObjectId value should be preserved",
      );
    });
  });

  describe("duplicate migration prevention (Issue 3: unique index)", () => {
    it("prevents duplicate migration records via unique index", async () => {
      const connection = ctx.connection;
      const migrationModel = connection.model("MongoMigration");

      await migrationModel.create({ id: "test-migration" });

      await assert.rejects(
        async () => migrationModel.create({ id: "test-migration" }),
        (error: Error) => {
          return (
            error.message.includes("duplicate key") ||
            error.message.includes("E11000")
          );
        },
        "should reject duplicate migration id with unique constraint error",
      );
    });
  });
});
