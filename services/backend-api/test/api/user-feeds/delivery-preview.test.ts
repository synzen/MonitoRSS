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
  "POST /api/v1/user-feeds/:feedId/delivery-preview",
  { concurrency: true },
  () => {
    const deliveryPreviewMockHandler = (req: { body?: unknown }) => {
      const reqBody = req.body as Record<string, unknown> | undefined;
      return {
        status: 200,
        body: {
          receivedSkip: reqBody?.skip,
          receivedLimit: reqBody?.limit,
        },
      };
    };

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/delivery-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        "/api/v1/user-feeds/not-valid-id/delivery-preview",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for non-existent valid ObjectId", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const nonExistentId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${nonExistentId}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when feed belongs to another user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Delivery Preview Feed",
        url: "https://example.com/other-delivery-preview.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when user owns the feed", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Own Feed Delivery Preview",
        url: "https://example.com/own-delivery-preview.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(sharedManagerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Delivery Preview",
        url: "https://example.com/shared-delivery-preview.xml",
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
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({}),
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
        title: "Admin Access Delivery Preview Feed",
        url: "https://example.com/admin-delivery-preview.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 400 when limit is below minimum", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Limit Validation",
        url: "https://example.com/delivery-preview-limit-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({ limit: 0 }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when limit exceeds maximum", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Limit Max Validation",
        url: "https://example.com/delivery-preview-limit-max.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({ limit: 51 }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when skip is negative", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Skip Validation",
        url: "https://example.com/delivery-preview-skip-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({ skip: -1 }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 200 with default skip/limit when body is empty", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Default Params",
        url: "https://example.com/delivery-preview-default-params.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { receivedSkip: number; receivedLimit: number };
      };
      assert.strictEqual(body.result.receivedSkip, 0);
      assert.strictEqual(body.result.receivedLimit, 10);
    });

    it("forwards skip and limit in the upstream request body", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Forward Params",
        url: "https://example.com/delivery-preview-forward-params.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({ skip: 5, limit: 20 }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { receivedSkip: number; receivedLimit: number };
      };
      assert.strictEqual(body.result.receivedSkip, 5);
      assert.strictEqual(body.result.receivedLimit, 20);
    });

    it("filters connections for shared manager with limited connection IDs", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(sharedManagerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Filtered Connections",
        url: "https://example.com/delivery-preview-filtered.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        connections: {
          discordChannels: [
            {
              id: generateTestId(),
              name: "Connection 1",
              createdAt: new Date(),
              updatedAt: new Date(),
              details: { embeds: [], formatter: {} },
            } as never,
            {
              id: generateTestId(),
              name: "Connection 2",
              createdAt: new Date(),
              updatedAt: new Date(),
              details: { embeds: [], formatter: {} },
            } as never,
          ],
        },
      });

      const createdFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      const firstConnectionId = createdFeed!.connections.discordChannels[0]!.id;

      await ctx.container.userFeedRepository.findOneAndUpdate(
        { _id: feed.id },
        {
          $set: {
            shareManageOptions: {
              invites: [
                {
                  discordUserId: sharedManagerDiscordUserId,
                  status: UserFeedManagerStatus.Accepted,
                  connections: [{ connectionId: firstConnectionId }],
                },
              ],
            },
          },
        },
      );

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);

      const upstreamRequests = feedApiMockServer
        .getRequestsForPath("/v1/user-feeds/delivery-preview")
        .filter(
          (r) =>
            (r.body as Record<string, unknown>)?.feed &&
            (
              (r.body as Record<string, unknown>).feed as Record<
                string,
                unknown
              >
            ).id === feed.id,
        );
      assert.strictEqual(upstreamRequests.length, 1);
      const mediums = (upstreamRequests[0]!.body as Record<string, unknown>)
        .mediums as Array<{ id: string }>;
      assert.strictEqual(mediums.length, 1);
      assert.strictEqual(mediums[0]!.id, firstConnectionId);
    });

    it("shared manager without connection restrictions sees all connections in delivery preview", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(sharedManagerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview All Connections",
        url: "https://example.com/delivery-preview-all.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        connections: {
          discordChannels: [
            {
              id: generateTestId(),
              name: "Connection 1",
              createdAt: new Date(),
              updatedAt: new Date(),
              details: { embeds: [], formatter: {} },
            } as never,
            {
              id: generateTestId(),
              name: "Connection 2",
              createdAt: new Date(),
              updatedAt: new Date(),
              details: { embeds: [], formatter: {} },
            } as never,
          ],
        },
      });

      await ctx.container.userFeedRepository.findOneAndUpdate(
        { _id: feed.id },
        {
          $set: {
            shareManageOptions: {
              invites: [
                {
                  discordUserId: sharedManagerDiscordUserId,
                  status: UserFeedManagerStatus.Accepted,
                },
              ],
            },
          },
        },
      );

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);

      const upstreamRequests = feedApiMockServer
        .getRequestsForPath("/v1/user-feeds/delivery-preview")
        .filter(
          (r) =>
            (r.body as Record<string, unknown>)?.feed &&
            (
              (r.body as Record<string, unknown>).feed as Record<
                string,
                unknown
              >
            ).id === feed.id,
        );
      assert.strictEqual(upstreamRequests.length, 1);
      const mediums = (upstreamRequests[0]!.body as Record<string, unknown>)
        .mediums as Array<{ id: string }>;
      assert.strictEqual(mediums.length, 2);
    });
  },
);
