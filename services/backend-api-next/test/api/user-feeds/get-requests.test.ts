import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../../helpers/test-http-server";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";

let ctx: AppTestContext;
let feedApiMockServer: TestHttpServer;

before(async () => {
  feedApiMockServer = createTestHttpServer();

  ctx = await createAppTestContext({
    configOverrides: {
      BACKEND_API_USER_FEEDS_API_HOST: feedApiMockServer.host,
      BACKEND_API_FEED_REQUESTS_API_HOST: feedApiMockServer.host,
    },
  });
});

after(async () => {
  await ctx.teardown();
  await feedApiMockServer.stop();
});

beforeEach(() => {
  feedApiMockServer.clear();
});

describe(
  "GET /api/v1/user-feeds/:feedId/requests",
  { concurrency: true },
  () => {
    const feedRequestsMockHandler = (req: { url: string }) => {
      const url = new URL(req.url, "http://localhost");
      return {
        status: 200,
        body: {
          result: {
            requests: [],
            nextRetryTimestamp: null,
            receivedLimit: url.searchParams.get("limit"),
            receivedSkip: url.searchParams.get("skip"),
          },
        },
      };
    };

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/requests`,
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        "/api/v1/user-feeds/not-valid-id/requests",
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for non-existent valid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const nonExistentId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${nonExistentId}/requests`,
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when feed belongs to another user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Owner's Feed",
        url: "https://example.com/owner-feed.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests`,
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when user owns the feed", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "My Feed",
        url: "https://example.com/my-feed.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        "/v1/feed-requests",
        feedRequestsMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(sharedManagerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Requests",
        url: "https://example.com/shared-feed-requests.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: sharedManagerDiscordUserId,
              status: UserFeedManagerStatus.Accepted,
            },
          ],
        },
      });

      feedApiMockServer.registerRoute(
        "GET",
        "/v1/feed-requests",
        feedRequestsMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when admin accesses another user's feed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const adminDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(adminDiscordUserId);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Access Feed Requests",
        url: "https://example.com/admin-feed-requests.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        "/v1/feed-requests",
        feedRequestsMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 400 when limit is below minimum", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Limit Validation",
        url: "https://example.com/limit-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?limit=0`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when limit exceeds maximum", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Limit Max Validation",
        url: "https://example.com/limit-max-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?limit=51`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when skip is negative", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Skip Validation",
        url: "https://example.com/skip-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?skip=-1`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when limit is not a number", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Limit NaN Validation",
        url: "https://example.com/limit-nan-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?limit=abc`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("forwards limit and skip query params to upstream API", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Query Forward",
        url: "https://example.com/query-forward.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        "/v1/feed-requests",
        feedRequestsMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?limit=10&skip=5`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { receivedLimit: string; receivedSkip: string };
      };
      assert.strictEqual(body.result.receivedLimit, "10");
      assert.strictEqual(body.result.receivedSkip, "5");
    });
  },
);
