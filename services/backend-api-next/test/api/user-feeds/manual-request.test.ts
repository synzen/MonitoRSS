import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { createMockAccessToken } from "../../helpers/mock-factories";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../../helpers/test-http-server";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedManagerStatus,
} from "../../../src/repositories/shared/enums";

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
  "POST /api/v1/user-feeds/:feedId/manual-request",
  { concurrency: true },
  () => {
    const feedRequestOverrides: Record<string, unknown> = {};
    const getArticlesOverrides: Record<string, unknown> = {};

    beforeEach(() => {
      feedApiMockServer.registerRoute("POST", "/v1/feed-requests", (req) => {
        const reqUrl = (req.body as { url?: string })?.url ?? "";
        const override = feedRequestOverrides[reqUrl];

        if (override) {
          return { status: 200, body: override };
        }

        return {
          status: 200,
          body: {
            requestStatus: "SUCCESS",
            response: { body: "<rss></rss>", statusCode: 200 },
          },
        };
      });

      feedApiMockServer.registerRoute(
        "POST",
        "/v1/user-feeds/get-articles",
        (req) => {
          const reqUrl = (req.body as { url?: string })?.url ?? "";
          const override = getArticlesOverrides[reqUrl];

          if (override) {
            return { status: 200, body: override };
          }

          return {
            status: 200,
            body: {
              result: {
                requestStatus: "SUCCESS",
                articles: [],
                totalArticles: 0,
                selectedProperties: [],
              },
            },
          };
        },
      );
    });

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/manual-request`,
        { method: "POST" },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed ID", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const nonExistentId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${nonExistentId}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 with result on success", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Manual Request Feed",
        url: "https://example.com/manual-request-feed.xml",
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          hasEnabledFeed: boolean;
        };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.strictEqual(body.result.hasEnabledFeed, true);
    });

    it("returns 422 when manual request is too soon", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Manual Request Too Soon Feed",
        url: "https://example.com/manual-request-too-soon.xml",
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          healthStatus: UserFeedHealthStatus.Failed,
          lastManualRequestAt: new Date(),
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 422);
      const body = (await response.json()) as {
        result: { minutesUntilNextRequest: number };
      };
      assert.ok(body.result);
      assert.ok(typeof body.result.minutesUntilNextRequest === "number");
      assert.ok(body.result.minutesUntilNextRequest > 0);
    });

    it("returns 404 when feed belongs to a different user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(otherDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Manual Request Feed",
        url: "https://example.com/other-user-manual-request.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when shared manager triggers manual request", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Manager Manual Request Feed",
        url: "https://example.com/shared-manager-manual-request.xml",
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

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { requestStatus: string };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
    });

    it("returns 200 when admin triggers manual request on another user's feed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const adminDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Manual Request Feed",
        url: "https://example.com/admin-manual-request.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { requestStatus: string };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 200 with non-success requestStatus when upstream fetch fails", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = "https://example.com/fetch-fail-manual-request.xml";

      feedRequestOverrides[feedUrl] = {
        requestStatus: "FETCH_ERROR",
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "Fetch Fail Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          hasEnabledFeed: boolean;
        };
      };
      assert.strictEqual(body.result.requestStatus, "FETCH_ERROR");
      assert.strictEqual(body.result.hasEnabledFeed, false);

      delete feedRequestOverrides[feedUrl];
    });

    it("returns 200 with requestStatusCode when upstream returns BAD_STATUS_CODE", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = "https://example.com/bad-status-manual-request.xml";

      feedRequestOverrides[feedUrl] = {
        requestStatus: "BAD_STATUS_CODE",
        response: { statusCode: 403 },
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "Bad Status Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          requestStatusCode: number;
          hasEnabledFeed: boolean;
        };
      };
      assert.strictEqual(body.result.requestStatus, "BAD_STATUS_CODE");
      assert.strictEqual(body.result.requestStatusCode, 403);
      assert.strictEqual(body.result.hasEnabledFeed, false);

      delete feedRequestOverrides[feedUrl];
    });

    it("clears disabledCode when fetch succeeds and feed was not disabled with InvalidFeed", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Disabled Manual Request Feed",
        url: "https://example.com/disabled-manual-request.xml",
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { hasEnabledFeed: boolean };
      };
      assert.strictEqual(body.result.hasEnabledFeed, true);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(updatedFeed.disabledCode, undefined);
      assert.strictEqual(updatedFeed.healthStatus, UserFeedHealthStatus.Ok);
    });

    it("does not clear disabledCode when fetch fails", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = "https://example.com/still-disabled-manual-request.xml";

      feedRequestOverrides[feedUrl] = {
        requestStatus: "FETCH_ERROR",
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "Still Disabled Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { hasEnabledFeed: boolean };
      };
      assert.strictEqual(body.result.hasEnabledFeed, false);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(
        updatedFeed.disabledCode,
        UserFeedDisabledCode.FailedRequests,
      );
      assert.strictEqual(updatedFeed.healthStatus, UserFeedHealthStatus.Failed);

      delete feedRequestOverrides[feedUrl];
    });

    it("checks article properties when feed disabled with InvalidFeed and re-enables on success", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = "https://example.com/invalid-feed-manual-request.xml";

      getArticlesOverrides[feedUrl] = {
        result: {
          requestStatus: "SUCCESS",
          articles: [{ title: "Article 1" }],
          totalArticles: 1,
          selectedProperties: ["title"],
        },
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "InvalidFeed Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.InvalidFeed,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          getArticlesRequestStatus: string;
          hasEnabledFeed: boolean;
        };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.strictEqual(body.result.getArticlesRequestStatus, "SUCCESS");
      assert.strictEqual(body.result.hasEnabledFeed, true);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(updatedFeed.disabledCode, undefined);

      delete getArticlesOverrides[feedUrl];
    });

    it("does not re-enable when feed disabled with InvalidFeed and article check fails", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl =
        "https://example.com/invalid-feed-fail-manual-request.xml";

      getArticlesOverrides[feedUrl] = {
        result: {
          requestStatus: "PARSE_ERROR",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "InvalidFeed Fail Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.InvalidFeed,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          getArticlesRequestStatus: string;
          hasEnabledFeed: boolean;
        };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.strictEqual(body.result.getArticlesRequestStatus, "PARSE_ERROR");
      assert.strictEqual(body.result.hasEnabledFeed, false);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(
        updatedFeed.disabledCode,
        UserFeedDisabledCode.InvalidFeed,
      );

      delete getArticlesOverrides[feedUrl];
    });
  },
);
