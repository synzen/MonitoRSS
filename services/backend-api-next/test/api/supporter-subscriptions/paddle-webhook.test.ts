import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { createHmac } from "crypto";
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
  SubscriptionProductKey,
  SubscriptionStatus,
} from "../../../src/repositories/shared/enums";

const WEBHOOK_SECRET = "test-paddle-webhook-secret";

function createWebhookSignature(requestBody: string, timestamp?: string) {
  const ts = timestamp ?? String(Math.floor(Date.now() / 1000));
  const signedPayload = `${ts}:${requestBody}`;
  const hmac = createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  return `ts=${ts};h1=${hmac}`;
}

function createSubscriptionUpdatedEvent(
  overrides: Record<string, unknown> = {},
) {
  const now = new Date().toISOString();
  return {
    event_type: "subscription.updated",
    data: {
      id: generateTestId(),
      status: "active",
      customer_id: generateTestId(),
      created_at: now,
      custom_data: {
        userId: generateTestId(),
      },
      updated_at: now,
      items: [
        {
          quantity: 1,
          price: {
            id: generateTestId(),
            product_id: generateTestId(),
          },
        },
      ],
      billing_cycle: {
        interval: "month",
        frequency: 1,
      },
      currency_code: "USD",
      next_billed_at: now,
      scheduled_change: null,
      current_billing_period: {
        ends_at: now,
        starts_at: now,
      },
      ...overrides,
    },
  };
}

function createSubscriptionActivatedEvent(
  overrides: Record<string, unknown> = {},
) {
  const now = new Date().toISOString();
  return {
    event_type: "subscription.activated",
    data: {
      id: generateTestId(),
      status: "active",
      customer_id: generateTestId(),
      created_at: now,
      custom_data: {
        userId: generateTestId(),
      },
      updated_at: now,
      items: [
        {
          quantity: 1,
          price: {
            id: generateTestId(),
            product_id: generateTestId(),
          },
        },
      ],
      billing_cycle: {
        interval: "month",
        frequency: 1,
      },
      currency_code: "USD",
      next_billed_at: now,
      scheduled_change: null,
      current_billing_period: {
        ends_at: now,
        starts_at: now,
      },
      ...overrides,
    },
  };
}

function createSubscriptionCanceledEvent(
  overrides: Record<string, unknown> = {},
) {
  return {
    event_type: "subscription.canceled",
    data: {
      id: generateTestId(),
      status: "canceled",
      customer_id: generateTestId(),
      ...overrides,
    },
  };
}

function createMockPaddleApi(): MockApi & { server: TestHttpServer } {
  const server = createTestHttpServer();

  return {
    server,
    configKey: "BACKEND_API_PADDLE_URL",
    intercept() {
      return generateTestId();
    },
    async stop() {
      await server.stop();
    },
  };
}

describe("Paddle Webhook API", { concurrency: true }, () => {
  describe("Signature Verification", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 401 when signature is missing", async () => {
      const event = createSubscriptionUpdatedEvent();
      const body = JSON.stringify(event);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body,
        },
      );

      assert.strictEqual(response.status, 401);
    });

    it("returns 401 when signature is invalid", async () => {
      const event = createSubscriptionUpdatedEvent();
      const body = JSON.stringify(event);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": "ts=123456;h1=invalid-signature",
          },
          body,
        },
      );

      assert.strictEqual(response.status, 401);
    });

    it("returns 401 when signature has invalid format", async () => {
      const event = createSubscriptionUpdatedEvent();
      const body = JSON.stringify(event);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": "invalid-format",
          },
          body,
        },
      );

      assert.strictEqual(response.status, 401);
    });

    it("returns 401 when signature is missing timestamp", async () => {
      const event = createSubscriptionUpdatedEvent();
      const body = JSON.stringify(event);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": "h1=somehash",
          },
          body,
        },
      );

      assert.strictEqual(response.status, 401);
    });

    it("returns 401 when signature is missing hash", async () => {
      const event = createSubscriptionUpdatedEvent();
      const body = JSON.stringify(event);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": "ts=123456",
          },
          body,
        },
      );

      assert.strictEqual(response.status, 401);
    });

    it("returns 401 when timestamp value is empty", async () => {
      const event = createSubscriptionUpdatedEvent();
      const body = JSON.stringify(event);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": "ts=;h1=somehash",
          },
          body,
        },
      );

      assert.strictEqual(response.status, 401);
    });

    it("returns 401 when hash value is empty", async () => {
      const event = createSubscriptionUpdatedEvent();
      const body = JSON.stringify(event);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": "ts=123456;h1=",
          },
          body,
        },
      );

      assert.strictEqual(response.status, 401);
    });

    it("returns 200 for unknown event type with valid signature", async () => {
      const event = {
        event_type: "unknown.event",
        data: { id: generateTestId() },
      };
      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);
      const responseBody = (await response.json()) as { ok: number };
      assert.strictEqual(responseBody.ok, 1);
    });
  });

  describe("subscription.canceled event", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 200 for subscription.canceled event with valid signature", async () => {
      const event = createSubscriptionCanceledEvent();
      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);
      const responseBody = (await response.json()) as { ok: number };
      assert.strictEqual(responseBody.ok, 1);
    });

    it("nullifies subscription when supporter has matching subscription", async () => {
      const subscriptionId = generateTestId();
      const discordUserId = generateTestId();

      await ctx.container.supporterRepository.create({
        id: discordUserId,
        guilds: [],
        paddleCustomer: {
          customerId: generateTestId(),
          email: "test@example.com",
          lastCurrencyCodeUsed: "USD",
          subscription: {
            id: subscriptionId,
            productKey: SubscriptionProductKey.Tier1,
            status: SubscriptionStatus.Active,
            currencyCode: "USD",
            billingPeriodStart: new Date(),
            billingPeriodEnd: new Date(),
            billingInterval: "month",
            benefits: {
              maxUserFeeds: 35,
              allowWebhooks: true,
              dailyArticleLimit: 1000,
              refreshRateSeconds: 120,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const event = createSubscriptionCanceledEvent({ id: subscriptionId });
      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.strictEqual(supporter?.paddleCustomer?.subscription, null);
    });
  });

  describe("subscription.updated event", { concurrency: true }, () => {
    let ctx: AppTestContext;
    let paddleApi: MockApi & { server: TestHttpServer };

    before(async () => {
      paddleApi = createMockPaddleApi();
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
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

    it("returns 200 and updates supporter for valid subscription.updated event", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier1 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: { userId: user.id },
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.ok(supporter?.paddleCustomer);
      assert.strictEqual(supporter.paddleCustomer.customerId, customerId);
      assert.strictEqual(supporter.paddleCustomer.email, "billing@example.com");
      assert.strictEqual(
        supporter.paddleCustomer.subscription?.productKey,
        SubscriptionProductKey.Tier1,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription?.benefits.maxUserFeeds,
        35,
      );
    });

    it("skips processing when subscription status is canceled", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      const event = createSubscriptionUpdatedEvent({
        status: "canceled",
        customer_id: customerId,
        custom_data: { userId: user.id },
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.strictEqual(supporter, null);
    });

    it("adds extra feeds for Tier3AdditionalFeed addon", async () => {
      const tier3ProductId = generateTestId();
      const addonProductId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      paddleApi.server.registerRoute("GET", `/products/${tier3ProductId}`, {
        status: 200,
        body: {
          data: {
            id: tier3ProductId,
            custom_data: { key: SubscriptionProductKey.Tier3 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/products/${addonProductId}`, {
        status: 200,
        body: {
          data: {
            id: addonProductId,
            custom_data: { key: SubscriptionProductKey.Tier3AdditionalFeed },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: { userId: user.id },
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: tier3ProductId,
            },
          },
          {
            quantity: 5,
            price: {
              id: generateTestId(),
              product_id: addonProductId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.maxUserFeeds,
        145,
      );
      const addons = supporter.paddleCustomer.subscription.addons;
      if (!addons) throw new Error("addons should exist");
      assert.strictEqual(addons.length, 1);
      const firstAddon = addons[0];
      if (!firstAddon) throw new Error("first addon should exist");
      assert.strictEqual(
        firstAddon.key,
        SubscriptionProductKey.Tier3AdditionalFeed,
      );
      assert.strictEqual(firstAddon.quantity, 5);
    });

    it("sets cancellation date when scheduled_change.action is cancel", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier1 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const billingPeriodEnd = "2024-12-31T23:59:59Z";

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: { userId: user.id },
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
        scheduled_change: {
          action: "cancel",
          resume_at: null,
          effective_at: billingPeriodEnd,
        },
        current_billing_period: {
          starts_at: "2024-12-01T00:00:00Z",
          ends_at: billingPeriodEnd,
        },
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.ok(supporter.paddleCustomer.subscription.cancellationDate);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.cancellationDate.toISOString(),
        new Date(billingPeriodEnd).toISOString(),
      );
    });

    it("returns 500 when user is not found", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const nonExistentUserId = generateTestId();

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier1 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: { userId: nonExistentUserId },
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 500);
    });
  });

  describe("subscription.activated event", { concurrency: true }, () => {
    let ctx: AppTestContext;
    let paddleApi: MockApi & { server: TestHttpServer };

    before(async () => {
      paddleApi = createMockPaddleApi();
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
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

    it("returns 200 and creates supporter for valid subscription.activated event", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier2 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "newuser@example.com",
          },
        },
      });

      const event = createSubscriptionActivatedEvent({
        customer_id: customerId,
        custom_data: { userId: user.id },
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.ok(supporter?.paddleCustomer);
      assert.strictEqual(
        supporter.paddleCustomer.subscription?.productKey,
        SubscriptionProductKey.Tier2,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription?.benefits.maxUserFeeds,
        70,
      );
    });
  });

  describe("Webhook secret not configured", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: undefined,
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 500 when webhook secret is not configured", async () => {
      const event = createSubscriptionUpdatedEvent();
      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 500);
    });
  });

  describe("Edge cases", { concurrency: true }, () => {
    let ctx: AppTestContext;
    let paddleApi: MockApi & { server: TestHttpServer };

    before(async () => {
      paddleApi = createMockPaddleApi();
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
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

    it("returns 500 when custom_data.userId is missing", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier1 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: {},
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 500);
    });

    it("returns 500 when product key has no benefits defined", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: "unknown-product-key" },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: { userId: user.id },
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 500);
    });

    it("handles yearly billing interval correctly", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier1 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: { userId: user.id },
        billing_cycle: {
          interval: "year",
          frequency: 1,
        },
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.billingInterval,
        "year",
      );
    });

    it("handles null next_billed_at correctly", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier1 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: { userId: user.id },
        next_billed_at: null,
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.nextBillDate,
        null,
      );
    });

    it("clears cancellation date when scheduled_change is null", async () => {
      const productId = generateTestId();
      const customerId = generateTestId();
      const discordUserId = generateTestId();

      const user = await ctx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@test.com`,
      });

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier1 },
          },
        },
      });

      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: {
          data: {
            email: "billing@example.com",
          },
        },
      });

      const event = createSubscriptionUpdatedEvent({
        customer_id: customerId,
        custom_data: { userId: user.id },
        scheduled_change: null,
        items: [
          {
            quantity: 1,
            price: {
              id: generateTestId(),
              product_id: productId,
            },
          },
        ],
      });

      const body = JSON.stringify(event);
      const signature = createWebhookSignature(body);

      const response = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": signature,
          },
          body,
        },
      );

      assert.strictEqual(response.status, 200);

      const supporter =
        await ctx.container.supporterRepository.findById(discordUserId);
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.cancellationDate,
        null,
      );
    });
  });
});
