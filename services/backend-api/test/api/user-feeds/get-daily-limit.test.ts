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
  "GET /api/v1/user-feeds/:feedId/daily-limit",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/daily-limit`,
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        "/api/v1/user-feeds/not-valid-id/daily-limit",
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
        `/api/v1/user-feeds/${nonExistentId}/daily-limit`,
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
        title: "Other User Daily Limit Feed",
        url: "https://example.com/other-daily-limit.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/daily-limit`,
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 with current and max on success", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Daily Limit Feed",
        url: "https://example.com/daily-limit.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        `/v1/user-feeds/${feed.id}/delivery-count`,
        () => ({
          status: 200,
          body: { result: { count: 42 } },
        }),
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/daily-limit`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { current: number; max: number };
      };
      assert.strictEqual(body.result.current, 42);
      assert.strictEqual(body.result.max, 0);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(sharedManagerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Daily Limit Feed",
        url: "https://example.com/shared-daily-limit.xml",
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
        `/v1/user-feeds/${feed.id}/delivery-count`,
        () => ({
          status: 200,
          body: { result: { count: 7 } },
        }),
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/daily-limit`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { current: number; max: number };
      };
      assert.strictEqual(body.result.current, 7);
      assert.strictEqual(body.result.max, 0);
    });

    it("returns 404 when user has a pending (not accepted) invite", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const pendingDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(pendingDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Pending Invite Daily Limit Feed",
        url: "https://example.com/pending-daily-limit.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: pendingDiscordUserId,
              status: UserFeedManagerStatus.Pending,
            },
          ],
        },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/daily-limit`,
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when user is an admin accessing another user's feed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const adminDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(adminDiscordUserId);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Daily Limit Feed",
        url: "https://example.com/admin-daily-limit.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        `/v1/user-feeds/${feed.id}/delivery-count`,
        () => ({
          status: 200,
          body: { result: { count: 99 } },
        }),
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/daily-limit`,
        {
          method: "GET",
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { current: number; max: number };
      };
      assert.strictEqual(body.result.current, 99);
      assert.strictEqual(body.result.max, 0);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });
  },
);
