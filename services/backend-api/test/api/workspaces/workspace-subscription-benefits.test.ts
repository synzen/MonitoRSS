import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateTestId } from "../../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../../helpers/test-http-server";
import type { MockApi } from "../../helpers/mock-apis";
import {
  TEST_PADDLE_WEBHOOK_SECRET,
  createWebhookSignature,
  createSubscriptionEvent,
  createMockPaddleApi,
} from "../../helpers/paddle-fixtures";
import { SubscriptionProductKey } from "../../../src/repositories/shared/enums";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface WorkspaceDetailResult {
  result: {
    id: string;
    maxFeeds: number;
    subscription: { productKey: string; status: string } | null;
  };
}

async function seedWorkspaceUser(
  ctx: AppTestContext,
  discordUserId: string,
): Promise<string> {
  await ctx.container.userRepository.create({
    discordUserId,
    email: `${discordUserId}@example.com`,
  });

  await ctx.connection.collection("users").updateOne(
    { discordUserId },
    {
      $set: {
        "featureFlags.workspaces": true,
        verifiedEmail: `verified-${discordUserId}@example.com`,
        verifiedEmailVerifiedAt: new Date(),
      },
    },
  );

  const id =
    await ctx.container.userRepository.findIdByDiscordId(discordUserId);
  return id as string;
}

describe(
  "Workspace benefits resolution (Paddle configured)",
  { concurrency: true },
  () => {
    let ctx: AppTestContext;
    let paddleApi: MockApi & { server: TestHttpServer };
    let feedApiMockServer: TestHttpServer;

    before(async () => {
      paddleApi = createMockPaddleApi();
      feedApiMockServer = createTestHttpServer();
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: TEST_PADDLE_WEBHOOK_SECRET,
          BACKEND_API_ENABLE_SUPPORTERS: true,
          BACKEND_API_PADDLE_URL: paddleApi.server.host,
          BACKEND_API_PADDLE_KEY: "test-paddle-key",
          BACKEND_API_USER_FEEDS_API_HOST: feedApiMockServer.host,
          BACKEND_API_FEED_REQUESTS_API_HOST: feedApiMockServer.host,
        },
        mockApis: {
          paddle: paddleApi,
        },
      });
    });

    after(async () => {
      await ctx.teardown();
      await paddleApi.stop();
      await feedApiMockServer.stop();
    });

    function mockFeedFetch(feedUrl: string) {
      feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
        status: 200,
        body: {
          result: {
            requestStatus: "SUCCESS",
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
            url: feedUrl,
            feedTitle: "Feed",
          },
        },
      });
    }

    function registerPaddleProduct(productId: string, key: string) {
      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key },
          },
        },
      });
    }

    function registerPaddleCustomer(customerId: string, email: string) {
      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: { email },
        },
      });
    }

    async function postWebhook(event: unknown): Promise<Response> {
      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      return ctx.fetch("/api/v1/subscription-products/paddle-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Paddle-Signature": signature,
        },
        body,
      });
    }

    async function createWorkspaceAsUser(discordUserId: string) {
      const user = await ctx.asUser(discordUserId);
      const slug = `ws-${randomUUID().slice(0, 18)}`;
      const res = await user.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: "Benefits Workspace", slug }),
      });
      assert.strictEqual(res.status, 201);
      const created = await readJson<{ result: { id: string } }>(res);
      return { user, workspaceId: created.result.id, slug };
    }

    async function activateSubscription(
      workspaceId: string,
      items: Array<{ key: string; quantity: number }>,
      overrides: Record<string, unknown> = {},
    ) {
      const customerId = generateTestId();
      registerPaddleCustomer(customerId, "owner-billing@example.com");

      const eventItems = items.map(({ key, quantity }) => {
        const productId = generateTestId();
        registerPaddleProduct(productId, key);
        return {
          quantity,
          price: { id: generateTestId(), product_id: productId },
        };
      });

      const event = createSubscriptionEvent("subscription.activated", {
        customer_id: customerId,
        custom_data: { workspaceId },
        items: eventItems,
        ...overrides,
      });

      const res = await postWebhook(event);
      assert.strictEqual(res.status, 200);
    }

    it("resolves an active Tier 2 workspace subscription to the Tier 2 feed limit", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const { user, workspaceId, slug } =
        await createWorkspaceAsUser(discordUserId);

      await activateSubscription(workspaceId, [
        { key: SubscriptionProductKey.Tier2, quantity: 1 },
      ]);

      const detail = await readJson<WorkspaceDetailResult>(
        await user.fetch(`/api/v1/workspaces/${slug}`),
      );

      assert.strictEqual(detail.result.maxFeeds, 70);
    });

    it("extends the Tier 3 feed limit by the add-on quantity", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const { user, workspaceId, slug } =
        await createWorkspaceAsUser(discordUserId);

      await activateSubscription(workspaceId, [
        { key: SubscriptionProductKey.Tier3, quantity: 1 },
        { key: SubscriptionProductKey.Tier3AdditionalFeed, quantity: 5 },
      ]);

      const detail = await readJson<WorkspaceDetailResult>(
        await user.fetch(`/api/v1/workspaces/${slug}`),
      );

      assert.strictEqual(detail.result.maxFeeds, 145);
    });

    it("resolves a never-subscribed workspace as dormant with a zero feed limit", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const { user, slug } = await createWorkspaceAsUser(discordUserId);

      const detail = await readJson<WorkspaceDetailResult>(
        await user.fetch(`/api/v1/workspaces/${slug}`),
      );

      assert.strictEqual(detail.result.maxFeeds, 0);
      assert.strictEqual(detail.result.subscription, null);
    });

    it("rejects feed creation in a dormant workspace with a distinct error code", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const { user, workspaceId } = await createWorkspaceAsUser(discordUserId);

      const feedUrl = `https://example.com/${generateTestId()}.xml`;
      mockFeedFetch(feedUrl);

      const res = await user.fetch("/api/v1/user-feeds", {
        method: "POST",
        body: JSON.stringify({ url: feedUrl, workspaceId }),
      });

      assert.strictEqual(res.status, 400);
      const body = await readJson<{ code: string }>(res);
      assert.strictEqual(body.code, "WORKSPACE_NOT_SUBSCRIBED");
    });

    it("disables all workspace feeds at lapse and re-enables them on resubscribe", async () => {
      const discordUserId = randomUUID();
      const userId = await seedWorkspaceUser(ctx, discordUserId);
      const { user, workspaceId, slug } =
        await createWorkspaceAsUser(discordUserId);

      const subscriptionId = generateTestId();
      await activateSubscription(
        workspaceId,
        [{ key: SubscriptionProductKey.Tier2, quantity: 1 }],
        { id: subscriptionId },
      );

      for (let i = 0; i < 2; i++) {
        await ctx.container.userFeedRepository.create({
          title: `Workspace Feed ${i}`,
          url: `https://example.com/${generateTestId()}.xml`,
          user: { id: userId, discordUserId },
          workspaceId,
        });
      }

      const cancelEvent = {
        event_type: "subscription.canceled",
        data: {
          id: subscriptionId,
          status: "canceled",
          customer_id: generateTestId(),
        },
      };
      assert.strictEqual((await postWebhook(cancelEvent)).status, 200);

      const detailAfterLapse = await readJson<WorkspaceDetailResult>(
        await user.fetch(`/api/v1/workspaces/${slug}`),
      );
      assert.strictEqual(detailAfterLapse.result.subscription, null);
      assert.strictEqual(detailAfterLapse.result.maxFeeds, 0);

      const lapsedList = await readJson<{
        total: number;
        results: Array<{ id: string; disabledCode?: string }>;
      }>(
        await user.fetch(
          `/api/v1/user-feeds?limit=100&offset=0&workspaceId=${workspaceId}`,
        ),
      );

      assert.strictEqual(lapsedList.total, 2, "no feeds may be deleted");
      assert.ok(
        lapsedList.results.every(
          (f) => f.disabledCode === "EXCEEDED_FEED_LIMIT",
        ),
        `all workspace feeds should be disabled at lapse, got ${JSON.stringify(
          lapsedList.results.map((f) => f.disabledCode),
        )}`,
      );

      await activateSubscription(
        workspaceId,
        [{ key: SubscriptionProductKey.Tier2, quantity: 1 }],
        { id: generateTestId() },
      );

      const resubscribedList = await readJson<{
        total: number;
        results: Array<{ id: string; disabledCode?: string }>;
      }>(
        await user.fetch(
          `/api/v1/user-feeds?limit=100&offset=0&workspaceId=${workspaceId}`,
        ),
      );

      assert.strictEqual(resubscribedList.total, 2);
      assert.ok(
        resubscribedList.results.every((f) => !f.disabledCode),
        `all workspace feeds should be re-enabled on resubscribe, got ${JSON.stringify(
          resubscribedList.results.map((f) => f.disabledCode),
        )}`,
      );
    });

    it("disables the oldest feeds beyond the new limit on a Tier 3 → Tier 2 downgrade", async () => {
      const discordUserId = randomUUID();
      const userId = await seedWorkspaceUser(ctx, discordUserId);
      const { user, workspaceId } = await createWorkspaceAsUser(discordUserId);

      const subscriptionId = generateTestId();
      await activateSubscription(
        workspaceId,
        [{ key: SubscriptionProductKey.Tier3, quantity: 1 }],
        { id: subscriptionId },
      );

      const feedIds: string[] = [];
      for (let i = 0; i < 71; i++) {
        const feed = await ctx.container.userFeedRepository.create({
          title: `Workspace Feed ${i}`,
          url: `https://example.com/${generateTestId()}.xml`,
          user: { id: userId, discordUserId },
          workspaceId,
        });
        feedIds.push(feed.id);
      }

      const oldestId = feedIds[0]!;
      await ctx.connection
        .collection("userfeeds")
        .updateOne(
          { _id: new Types.ObjectId(oldestId) },
          { $set: { createdAt: new Date("2020-01-01") } },
        );

      const customerId = generateTestId();
      registerPaddleCustomer(customerId, "owner-billing@example.com");
      const tier2ProductId = generateTestId();
      registerPaddleProduct(tier2ProductId, SubscriptionProductKey.Tier2);

      const downgradeEvent = createSubscriptionEvent("subscription.updated", {
        id: subscriptionId,
        customer_id: customerId,
        custom_data: { workspaceId },
        items: [
          {
            quantity: 1,
            price: { id: generateTestId(), product_id: tier2ProductId },
          },
        ],
      });
      assert.strictEqual((await postWebhook(downgradeEvent)).status, 200);

      const list = await readJson<{
        total: number;
        results: Array<{ id: string; disabledCode?: string }>;
      }>(
        await user.fetch(
          `/api/v1/user-feeds?limit=100&offset=0&workspaceId=${workspaceId}`,
        ),
      );

      assert.strictEqual(list.total, 71);
      const disabled = list.results.filter(
        (f) => f.disabledCode === "EXCEEDED_FEED_LIMIT",
      );
      assert.strictEqual(disabled.length, 1);
      assert.strictEqual(disabled[0]?.id, oldestId);
    });

    it("keeps membership, invitations, and settings working while dormant", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const { user, slug } = await createWorkspaceAsUser(discordUserId);

      const membersRes = await user.fetch(`/api/v1/workspaces/${slug}/members`);
      assert.strictEqual(membersRes.status, 200);

      const invitesRes = await user.fetch(`/api/v1/workspaces/${slug}/invites`);
      assert.strictEqual(invitesRes.status, 200);

      const renameRes = await user.fetch(`/api/v1/workspaces/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed While Dormant" }),
      });
      assert.strictEqual(renameRes.status, 200);
    });
  },
);

describe(
  "Workspace benefits resolution (Paddle not configured)",
  { concurrency: true },
  () => {
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

    it("gives never-subscribed workspaces the configured default benefits with no dormancy", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const user = await ctx.asUser(discordUserId);

      const slug = `ws-${randomUUID().slice(0, 18)}`;
      const createRes = await user.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: "Self-host Workspace", slug }),
      });
      assert.strictEqual(createRes.status, 201);
      const created = await readJson<{ result: { id: string } }>(createRes);

      const detail = await readJson<WorkspaceDetailResult>(
        await user.fetch(`/api/v1/workspaces/${slug}`),
      );
      // 140 is the test config's BACKEND_API_DEFAULT_MAX_WORKSPACE_FEEDS.
      assert.strictEqual(detail.result.maxFeeds, 140);

      const feedUrl = `https://example.com/${generateTestId()}.xml`;
      feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
        status: 200,
        body: {
          result: {
            requestStatus: "SUCCESS",
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
            url: feedUrl,
            feedTitle: "Feed",
          },
        },
      });

      const feedRes = await user.fetch("/api/v1/user-feeds", {
        method: "POST",
        body: JSON.stringify({ url: feedUrl, workspaceId: created.result.id }),
      });
      assert.strictEqual(feedRes.status, 201);
    });
  },
);
