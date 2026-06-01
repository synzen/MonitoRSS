import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import { randomUUID } from "crypto";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../../src/repositories/shared/enums";

describe("UserMongooseRepository Integration", { concurrency: false }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  beforeEach(async () => {
    await ctx.connection.model("UserFeed").deleteMany({});
    await ctx.connection.model("User").deleteMany({});
  });

  after(async () => {
    await ctx.teardown();
  });

  describe("aggregateUsersWithExpiredOrRevokedRedditCredentials", () => {
    const redditUrl = "https://www.reddit.com/r/test/.rss";
    const nonRedditUrl = "https://example.com/feed.xml";

    const createUser = async (
      discordUserId: string,
      credentials: Array<{
        type: string;
        status?: string;
        expireAt?: Date;
      }> | null,
    ) => {
      return ctx.connection.model("User").create({
        discordUserId,
        ...(credentials ? { externalCredentials: credentials } : {}),
      });
    };

    const createFeed = async (overrides: {
      discordUserId: string;
      url?: string;
      feedRequestLookupKey?: string;
    }) => {
      return ctx.connection.model("UserFeed").create({
        title: "Test Feed",
        url: overrides.url ?? redditUrl,
        user: {
          id: new Types.ObjectId(),
          discordUserId: overrides.discordUserId,
        },
        ...(overrides.feedRequestLookupKey
          ? { feedRequestLookupKey: overrides.feedRequestLookupKey }
          : {}),
      });
    };

    const collect = async (options?: {
      userIds?: string[];
      feedIds?: string[];
    }) => {
      const ids: string[] = [];
      for await (const {
        feedId,
      } of ctx.container.userRepository.aggregateUsersWithExpiredOrRevokedRedditCredentials(
        options,
      )) {
        ids.push(feedId);
      }
      return ids.sort();
    };

    it("returns reddit feeds whose owner's reddit credential is expired", async () => {
      const discordUserId = randomUUID();
      await createUser(discordUserId, [
        {
          type: UserExternalCredentialType.Reddit,
          status: UserExternalCredentialStatus.Active,
          expireAt: new Date(Date.now() - 1000),
        },
      ]);
      const feed = await createFeed({
        discordUserId,
        feedRequestLookupKey: randomUUID(),
      });

      const result = await collect();

      assert.deepStrictEqual(result, [feed._id.toString()]);
    });

    it("returns reddit feeds whose owner's reddit credential is revoked", async () => {
      const discordUserId = randomUUID();
      await createUser(discordUserId, [
        {
          type: UserExternalCredentialType.Reddit,
          status: UserExternalCredentialStatus.Revoked,
          expireAt: new Date(Date.now() + 100000),
        },
      ]);
      const feed = await createFeed({
        discordUserId,
        feedRequestLookupKey: randomUUID(),
      });

      const result = await collect();

      assert.deepStrictEqual(result, [feed._id.toString()]);
    });

    it("returns reddit feeds whose owner has no credentials at all", async () => {
      const discordUserId = randomUUID();
      await createUser(discordUserId, null);
      const feed = await createFeed({
        discordUserId,
        feedRequestLookupKey: randomUUID(),
      });

      const result = await collect();

      assert.deepStrictEqual(result, [feed._id.toString()]);
    });

    it("excludes feeds whose owner has an active, unexpired reddit credential", async () => {
      const discordUserId = randomUUID();
      await createUser(discordUserId, [
        {
          type: UserExternalCredentialType.Reddit,
          status: UserExternalCredentialStatus.Active,
          expireAt: new Date(Date.now() + 100000),
        },
      ]);
      await createFeed({
        discordUserId,
        feedRequestLookupKey: randomUUID(),
      });

      const result = await collect();

      assert.deepStrictEqual(result, []);
    });

    it("excludes feeds without a lookup key", async () => {
      const discordUserId = randomUUID();
      await createUser(discordUserId, null);
      await createFeed({ discordUserId });

      const result = await collect();

      assert.deepStrictEqual(result, []);
    });

    it("excludes non-reddit feeds", async () => {
      const discordUserId = randomUUID();
      await createUser(discordUserId, null);
      await createFeed({
        discordUserId,
        url: nonRedditUrl,
        feedRequestLookupKey: randomUUID(),
      });

      const result = await collect();

      assert.deepStrictEqual(result, []);
    });

    it("excludes orphaned feeds whose owner no longer exists", async () => {
      await createFeed({
        discordUserId: randomUUID(),
        feedRequestLookupKey: randomUUID(),
      });

      const result = await collect();

      assert.deepStrictEqual(result, []);
    });

    it("filters by feedIds when provided", async () => {
      const discordUserId = randomUUID();
      await createUser(discordUserId, null);
      const feedA = await createFeed({
        discordUserId,
        feedRequestLookupKey: randomUUID(),
      });
      await createFeed({
        discordUserId,
        feedRequestLookupKey: randomUUID(),
      });

      const result = await collect({ feedIds: [feedA._id.toString()] });

      assert.deepStrictEqual(result, [feedA._id.toString()]);
    });

    it("filters by userIds when provided", async () => {
      const discordUserIdA = randomUUID();
      const discordUserIdB = randomUUID();
      const userA = await createUser(discordUserIdA, null);
      await createUser(discordUserIdB, null);
      const feedA = await createFeed({
        discordUserId: discordUserIdA,
        feedRequestLookupKey: randomUUID(),
      });
      await createFeed({
        discordUserId: discordUserIdB,
        feedRequestLookupKey: randomUUID(),
      });

      const result = await collect({ userIds: [userA._id.toString()] });

      assert.deepStrictEqual(result, [feedA._id.toString()]);
    });
  });
});
