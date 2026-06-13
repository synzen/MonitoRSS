import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateTestId } from "../../helpers/test-id";
import type { TestHttpServer } from "../../helpers/test-http-server";
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

interface WorkspaceSubscriptionView {
  productKey: string;
  status: string;
  cancellationDate: string | null;
  addons: Array<{ key: string; quantity: number }>;
}

interface WorkspaceDetailResult {
  result: {
    id: string;
    name: string;
    slug: string;
    subscription: WorkspaceSubscriptionView | null;
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

describe("Workspace subscription webhook routing", { concurrency: true }, () => {
  let ctx: AppTestContext;
  let paddleApi: MockApi & { server: TestHttpServer };

  before(async () => {
    paddleApi = createMockPaddleApi();
    ctx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_PADDLE_WEBHOOK_SECRET: TEST_PADDLE_WEBHOOK_SECRET,
        BACKEND_API_PADDLE_URL: paddleApi.server.host,
        BACKEND_API_PADDLE_KEY: "test-paddle-key",
      },
      mockApis: {
        paddle: paddleApi,
      },
    });
  });

  after(async () => {
    await ctx.teardown();
    await paddleApi.stop();
  });

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
      body: JSON.stringify({ name: "Sub Workspace", slug }),
    });
    assert.strictEqual(res.status, 201);
    const created = await readJson<{ result: { id: string; slug: string } }>(
      res,
    );
    return { user, workspaceId: created.result.id, slug };
  }

  it("activates a workspace subscription from a webhook carrying a workspace id, observable via the workspace API", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const productId = generateTestId();
    const customerId = generateTestId();
    registerPaddleProduct(productId, SubscriptionProductKey.Tier2);
    registerPaddleCustomer(customerId, "owner-billing@example.com");

    const event = createSubscriptionEvent("subscription.activated", {
      customer_id: customerId,
      custom_data: { workspaceId },
      items: [
        {
          quantity: 1,
          price: { id: generateTestId(), product_id: productId },
        },
      ],
    });

    const webhookRes = await postWebhook(event);
    assert.strictEqual(webhookRes.status, 200);

    const readRes = await user.fetch(`/api/v1/workspaces/${slug}`);
    assert.strictEqual(readRes.status, 200);
    const detail = await readJson<WorkspaceDetailResult>(readRes);

    assert.ok(detail.result.subscription, "workspace should expose its subscription");
    assert.strictEqual(detail.result.subscription.status, "ACTIVE");
    assert.strictEqual(
      detail.result.subscription.productKey,
      SubscriptionProductKey.Tier2,
    );
  });

  it("does not create a personal supporter record for a workspace-routed event, even when a user id is present", async () => {
    const discordUserId = randomUUID();
    const userId = await seedWorkspaceUser(ctx, discordUserId);
    const { workspaceId } = await createWorkspaceAsUser(discordUserId);

    const productId = generateTestId();
    const customerId = generateTestId();
    registerPaddleProduct(productId, SubscriptionProductKey.Tier2);
    registerPaddleCustomer(customerId, `${discordUserId}@example.com`);

    const event = createSubscriptionEvent("subscription.activated", {
      customer_id: customerId,
      custom_data: { workspaceId, userId },
      items: [
        {
          quantity: 1,
          price: { id: generateTestId(), product_id: productId },
        },
      ],
    });

    const webhookRes = await postWebhook(event);
    assert.strictEqual(webhookRes.status, 200);

    const supporter =
      await ctx.container.supporterRepository.findById(discordUserId);
    assert.strictEqual(
      supporter,
      null,
      "workspace-routed event must not touch the personal supporter record",
    );
  });

  it("keeps subscription records independent across two workspaces of the same owner", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const first = await createWorkspaceAsUser(discordUserId);

    const tier2ProductId = generateTestId();
    const tier3ProductId = generateTestId();
    const customerId = generateTestId();
    registerPaddleProduct(tier2ProductId, SubscriptionProductKey.Tier2);
    registerPaddleProduct(tier3ProductId, SubscriptionProductKey.Tier3);
    registerPaddleCustomer(customerId, "owner-billing@example.com");

    const firstEvent = createSubscriptionEvent("subscription.activated", {
      customer_id: customerId,
      custom_data: { workspaceId: first.workspaceId },
      items: [
        {
          quantity: 1,
          price: { id: generateTestId(), product_id: tier2ProductId },
        },
      ],
    });
    assert.strictEqual((await postWebhook(firstEvent)).status, 200);

    // The second workspace can only be created after the first activates
    // (never-activated creation cap).
    const second = await createWorkspaceAsUser(discordUserId);

    const secondEvent = createSubscriptionEvent("subscription.activated", {
      customer_id: customerId,
      custom_data: { workspaceId: second.workspaceId },
      items: [
        {
          quantity: 1,
          price: { id: generateTestId(), product_id: tier3ProductId },
        },
      ],
    });
    assert.strictEqual((await postWebhook(secondEvent)).status, 200);

    const firstRead = await readJson<WorkspaceDetailResult>(
      await first.user.fetch(`/api/v1/workspaces/${first.slug}`),
    );
    const secondRead = await readJson<WorkspaceDetailResult>(
      await second.user.fetch(`/api/v1/workspaces/${second.slug}`),
    );

    assert.strictEqual(
      firstRead.result.subscription?.productKey,
      SubscriptionProductKey.Tier2,
    );
    assert.strictEqual(
      secondRead.result.subscription?.productKey,
      SubscriptionProductKey.Tier3,
    );
  });

  it("revises the workspace record on subscription.updated: tier change, addon quantity, and cancellation date", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const tier2ProductId = generateTestId();
    const tier3ProductId = generateTestId();
    const addonProductId = generateTestId();
    const customerId = generateTestId();
    registerPaddleProduct(tier2ProductId, SubscriptionProductKey.Tier2);
    registerPaddleProduct(tier3ProductId, SubscriptionProductKey.Tier3);
    registerPaddleProduct(
      addonProductId,
      SubscriptionProductKey.Tier3AdditionalFeed,
    );
    registerPaddleCustomer(customerId, "owner-billing@example.com");

    const subscriptionId = generateTestId();

    const activated = createSubscriptionEvent("subscription.activated", {
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
    assert.strictEqual((await postWebhook(activated)).status, 200);

    const billingPeriodEnd = "2027-01-31T23:59:59Z";
    const updated = createSubscriptionEvent("subscription.updated", {
      id: subscriptionId,
      customer_id: customerId,
      custom_data: { workspaceId },
      items: [
        {
          quantity: 1,
          price: { id: generateTestId(), product_id: tier3ProductId },
        },
        {
          quantity: 5,
          price: { id: generateTestId(), product_id: addonProductId },
        },
      ],
      scheduled_change: {
        action: "cancel",
        resume_at: null,
        effective_at: billingPeriodEnd,
      },
      current_billing_period: {
        starts_at: "2027-01-01T00:00:00Z",
        ends_at: billingPeriodEnd,
      },
    });
    assert.strictEqual((await postWebhook(updated)).status, 200);

    const detail = await readJson<WorkspaceDetailResult>(
      await user.fetch(`/api/v1/workspaces/${slug}`),
    );

    assert.ok(detail.result.subscription);
    assert.strictEqual(
      detail.result.subscription.productKey,
      SubscriptionProductKey.Tier3,
    );
    assert.deepStrictEqual(detail.result.subscription.addons, [
      { key: SubscriptionProductKey.Tier3AdditionalFeed, quantity: 5 },
    ]);
    assert.strictEqual(
      new Date(detail.result.subscription.cancellationDate as string).toISOString(),
      new Date(billingPeriodEnd).toISOString(),
    );
  });

  it("rejects a workspace-routed event carrying a personal-only tier, leaving the workspace unsubscribed", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const productId = generateTestId();
    const customerId = generateTestId();
    registerPaddleProduct(productId, SubscriptionProductKey.Tier1);
    registerPaddleCustomer(customerId, "owner-billing@example.com");

    const event = createSubscriptionEvent("subscription.activated", {
      customer_id: customerId,
      custom_data: { workspaceId },
      items: [
        {
          quantity: 1,
          price: { id: generateTestId(), product_id: productId },
        },
      ],
    });

    const webhookRes = await postWebhook(event);
    assert.strictEqual(webhookRes.status, 500);

    const detail = await readJson<WorkspaceDetailResult>(
      await user.fetch(`/api/v1/workspaces/${slug}`),
    );
    assert.strictEqual(detail.result.subscription, null);
  });

  it("acks a workspace-routed event whose workspace no longer exists without creating any record", async () => {
    const productId = generateTestId();
    const customerId = generateTestId();
    registerPaddleProduct(productId, SubscriptionProductKey.Tier2);
    const billingEmail = `nobody-${randomUUID()}@example.com`;
    registerPaddleCustomer(customerId, billingEmail);

    const event = createSubscriptionEvent("subscription.activated", {
      customer_id: customerId,
      custom_data: { workspaceId: "64b000000000000000000000" },
      items: [
        {
          quantity: 1,
          price: { id: generateTestId(), product_id: productId },
        },
      ],
    });

    // The workspace may have been deleted while the event was in flight.
    // Retries can never succeed, so the event must be acknowledged, and it
    // must not fall through to the personal supporter path.
    const webhookRes = await postWebhook(event);
    assert.strictEqual(webhookRes.status, 200);

    const supporter = await ctx.connection
      .collection("supporters")
      .findOne({ "paddleCustomer.customerId": customerId });
    assert.strictEqual(supporter, null);
  });
});
