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
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedManagerStatus,
} from "../../../src/repositories/shared/enums";
import type { MockApi } from "../../helpers/mock-apis";
import {
  TEST_PADDLE_WEBHOOK_SECRET,
  createMockPaddleApi,
} from "../../helpers/paddle-fixtures";

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
      const user = await ctx.asUser(generateSnowflake());
      const nonExistentId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${nonExistentId}/manual-request`,
        {
          method: "POST",
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 with result on success", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);

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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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
      const user = await ctx.asUser(otherDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Manual Request Feed",
        url: "https://example.com/other-user-manual-request.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when shared manager triggers manual request", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(sharedManagerDiscordUserId);

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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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
      const user = await ctx.asUser(adminDiscordUserId);

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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);
      const feedUrl = "https://example.com/fetch-fail-manual-request.xml";

      feedRequestOverrides[feedUrl] = {
        requestStatus: "FETCH_ERROR",
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "Fetch Fail Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);
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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);

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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);
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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);
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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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

    it("returns 400 with FEED_LIMIT_REACHED when re-enabling a failed feed while over the feed limit", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const maxFeeds = ctx.container.config.BACKEND_API_DEFAULT_MAX_USER_FEEDS;

      // Repository-level creates bypass the creation gate to simulate an
      // over-limit state (e.g. a limit decrease).
      const feeds = [];

      for (let i = 0; i <= maxFeeds; i++) {
        feeds.push(
          await ctx.container.userFeedRepository.create({
            title: `Over Limit Feed ${i}`,
            url: `https://example.com/over-limit-manual-request-${i}.xml`,
            user: { id: generateTestId(), discordUserId },
          }),
        );
      }

      await ctx.container.userFeedRepository.updateById(feeds[0]!.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feeds[0]!.id}/manual-request`,
        {
          method: "POST",
        },
      );

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_LIMIT_REACHED");

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feeds[0]!.id,
      );
      assert.strictEqual(
        updatedFeed?.disabledCode,
        UserFeedDisabledCode.FailedRequests,
      );
    });

    it("re-enables a failed feed when exactly at the feed limit", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const maxFeeds = ctx.container.config.BACKEND_API_DEFAULT_MAX_USER_FEEDS;

      // A FailedRequests feed still holds its limit slot, so a user at their
      // limit must be able to retry it.
      const feeds = [];

      for (let i = 0; i < maxFeeds; i++) {
        feeds.push(
          await ctx.container.userFeedRepository.create({
            title: `At Limit Feed ${i}`,
            url: `https://example.com/at-limit-manual-request-${i}.xml`,
            user: { id: generateTestId(), discordUserId },
          }),
        );
      }

      await ctx.container.userFeedRepository.updateById(feeds[0]!.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feeds[0]!.id}/manual-request`,
        {
          method: "POST",
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { hasEnabledFeed: boolean };
      };
      assert.strictEqual(body.result.hasEnabledFeed, true);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feeds[0]!.id,
      );
      assert.strictEqual(updatedFeed?.disabledCode, undefined);
    });

    for (const disabledCode of [
      UserFeedDisabledCode.ExceededFeedLimit,
      UserFeedDisabledCode.Manual,
    ]) {
      it(`does not clear ${disabledCode} disabledCode on a successful fetch`, async () => {
        const discordUserId = generateSnowflake();
        const user = await ctx.asUser(discordUserId);

        const feed = await ctx.container.userFeedRepository.create({
          title: `${disabledCode} Manual Request Feed`,
          url: `https://example.com/${disabledCode.toLowerCase()}-manual-request.xml`,
          user: { id: generateTestId(), discordUserId },
        });

        await ctx.container.userFeedRepository.updateById(feed.id, {
          $set: {
            disabledCode,
            healthStatus: UserFeedHealthStatus.Failed,
          },
        });

        const response = await user.fetch(
          `/api/v1/user-feeds/${feed.id}/manual-request`,
          {
            method: "POST",
          },
        );

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: { requestStatus: string; hasEnabledFeed: boolean };
        };
        assert.strictEqual(body.result.requestStatus, "SUCCESS");
        assert.strictEqual(body.result.hasEnabledFeed, false);

        const updatedFeed = await ctx.container.userFeedRepository.findById(
          feed.id,
        );
        assert.strictEqual(updatedFeed?.disabledCode, disabledCode);
      });
    }

    it("does not re-enable when feed disabled with InvalidFeed and article check fails", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
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

// A dedicated context with Paddle configured so a never-subscribed workspace
// resolves as dormant (feed limit 0).
describe(
  "POST /api/v1/user-feeds/:feedId/manual-request (dormant workspace)",
  { concurrency: false },
  () => {
    let workspaceCtx: AppTestContext;
    let paddleApi: MockApi & { server: TestHttpServer };
    let workspaceFeedApiMockServer: TestHttpServer;

    before(async () => {
      paddleApi = createMockPaddleApi();
      workspaceFeedApiMockServer = createTestHttpServer();
      workspaceCtx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: TEST_PADDLE_WEBHOOK_SECRET,
          BACKEND_API_ENABLE_SUPPORTERS: true,
          BACKEND_API_PADDLE_URL: paddleApi.server.host,
          BACKEND_API_PADDLE_KEY: "test-paddle-key",
          BACKEND_API_USER_FEEDS_API_HOST: workspaceFeedApiMockServer.host,
          BACKEND_API_FEED_REQUESTS_API_HOST: workspaceFeedApiMockServer.host,
        },
        mockApis: {
          paddle: paddleApi,
        },
      });
    });

    after(async () => {
      await workspaceCtx.teardown();
      await paddleApi.stop();
      await workspaceFeedApiMockServer.stop();
    });

    it("returns 400 with WORKSPACE_NOT_SUBSCRIBED and keeps the feed disabled", async () => {
      const discordUserId = generateSnowflake();

      await workspaceCtx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@example.com`,
      });
      await workspaceCtx.connection.collection("users").updateOne(
        { discordUserId },
        {
          $set: {
            "featureFlags.workspaces": true,
            verifiedEmail: `verified-${discordUserId}@example.com`,
            verifiedEmailVerifiedAt: new Date(),
          },
        },
      );

      const user = await workspaceCtx.asUser(discordUserId);

      const workspaceRes = await user.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: "Dormant Workspace",
          slug: `dormant-${discordUserId.slice(0, 8)}`,
        }),
      });
      assert.strictEqual(workspaceRes.status, 201);
      const workspaceBody = (await workspaceRes.json()) as {
        result: { id: string };
      };
      const workspaceId = workspaceBody.result.id;

      // Repository-level create bypasses the creation gate; mirrors a feed
      // left behind in a workspace whose subscription lapsed.
      const feed = await workspaceCtx.container.userFeedRepository.create({
        title: "Dormant Workspace Feed",
        url: "https://example.com/dormant-workspace-manual-request.xml",
        user: { id: generateTestId(), discordUserId },
        workspaceId,
      });

      await workspaceCtx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
        },
      );

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "WORKSPACE_NOT_SUBSCRIBED");

      const updatedFeed =
        await workspaceCtx.container.userFeedRepository.findById(feed.id);
      assert.strictEqual(
        updatedFeed?.disabledCode,
        UserFeedDisabledCode.FailedRequests,
      );
      assert.strictEqual(
        updatedFeed?.healthStatus,
        UserFeedHealthStatus.Failed,
      );
    });
  },
);
