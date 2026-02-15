import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import dayjs from "dayjs";
import {
  SubscriptionProductKey,
  LegacySubscriptionProductKey,
  SubscriptionStatus,
} from "../../src/repositories/shared/enums";
import { createPaddleWebhooksHarness } from "../helpers/paddle-webhooks.harness";
import { PaddleSubscriptionStatus } from "../../src/services/paddle-webhooks/types";

describe("PaddleWebhooksService", { concurrency: true }, () => {
  const harness = createPaddleWebhooksHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("isVerifiedWebhookEvent", () => {
    it("returns false when signature is missing", async () => {
      const ctx = harness.createContext();

      const result = await ctx.service.isVerifiedWebhookEvent({
        signature: undefined,
        requestBody: '{"test": true}',
      });

      assert.strictEqual(result, false);
    });

    it("returns false when signature format is invalid (missing timestamp)", async () => {
      const ctx = harness.createContext();

      const result = await ctx.service.isVerifiedWebhookEvent({
        signature: "h1=abc123",
        requestBody: '{"test": true}',
      });

      assert.strictEqual(result, false);
    });

    it("returns false when signature format is invalid (missing h1)", async () => {
      const ctx = harness.createContext();

      const result = await ctx.service.isVerifiedWebhookEvent({
        signature: "ts=12345",
        requestBody: '{"test": true}',
      });

      assert.strictEqual(result, false);
    });

    it("returns false when timestamp is missing value", async () => {
      const ctx = harness.createContext();

      const result = await ctx.service.isVerifiedWebhookEvent({
        signature: "ts=;h1=abc123",
        requestBody: '{"test": true}',
      });

      assert.strictEqual(result, false);
    });

    it("returns false when h1 is missing value", async () => {
      const ctx = harness.createContext();

      const result = await ctx.service.isVerifiedWebhookEvent({
        signature: "ts=12345;h1=",
        requestBody: '{"test": true}',
      });

      assert.strictEqual(result, false);
    });

    it("throws error when webhook secret is not configured", async () => {
      const ctx = harness.createContext({
        config: { BACKEND_API_PADDLE_WEBHOOK_SECRET: undefined },
      });

      await assert.rejects(
        () =>
          ctx.service.isVerifiedWebhookEvent({
            signature: "ts=12345;h1=abc123",
            requestBody: '{"test": true}',
          }),
        {
          message:
            "Missing webhook secret in config while verifying paddle webhook event",
        },
      );
    });

    it("returns false when HMAC does not match", async () => {
      const ctx = harness.createContext();

      const result = await ctx.service.isVerifiedWebhookEvent({
        signature: "ts=12345;h1=invalidhmac",
        requestBody: '{"test": true}',
      });

      assert.strictEqual(result, false);
    });

    it("returns true when HMAC matches", async () => {
      const ctx = harness.createContext();
      const requestBody = '{"test": true}';
      const signature = ctx.createWebhookSignature(requestBody);

      const result = await ctx.service.isVerifiedWebhookEvent({
        signature,
        requestBody,
      });

      assert.strictEqual(result, true);
    });
  });

  describe("handleSubscriptionUpdatedEvent", () => {
    it('returns early when status is "canceled"', async () => {
      const ctx = harness.createContext();
      const event = ctx.createSubscriptionUpdatedEvent({
        status: "canceled" as PaddleSubscriptionStatus,
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      assert.strictEqual(ctx.paddleService.getProduct.mock.callCount(), 0);
    });

    it("throws when product not found", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProduct: async () => ({
            paddleProductId: "prod-123",
            id: undefined,
          }),
        },
      });
      const event = ctx.createSubscriptionUpdatedEvent();

      await assert.rejects(
        () => ctx.service.handleSubscriptionUpdatedEvent(event),
        {
          message: /Could not find product key for product ids/,
        },
      );
    });

    it("throws when benefits not found for product key", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProduct: async () => ({
            paddleProductId: "prod-123",
            id: "unknown-tier" as SubscriptionProductKey,
          }),
        },
      });
      const event = ctx.createSubscriptionUpdatedEvent();

      await assert.rejects(
        () => ctx.service.handleSubscriptionUpdatedEvent(event),
        {
          message: /Could not find benefits in BENEFITS_BY_TIER/,
        },
      );
    });

    it("throws when userId missing in custom_data", async () => {
      const ctx = harness.createContext();
      const event = ctx.createSubscriptionActivatedEvent({
        custom_data: { userId: undefined },
      });

      await assert.rejects(
        () => ctx.service.handleSubscriptionUpdatedEvent(event),
        {
          message: /Could not find user id in custom_data/,
        },
      );
    });

    it("throws when user not found", async () => {
      const ctx = harness.createContext();
      const event = ctx.createSubscriptionUpdatedEvent();

      await assert.rejects(
        () => ctx.service.handleSubscriptionUpdatedEvent(event),
        {
          message: /Could not find user with user ID/,
        },
      );
    });

    it("successfully upserts supporter with paddle customer data", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser();
      const billingEmail = "billing@test.com";
      const now = new Date();
      const endDate = dayjs(now).add(1, "month").toDate();

      ctx.paddleService.getCustomer.mock.mockImplementation(async () => ({
        email: billingEmail,
      }));

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        customer_id: "ctm_123",
        currency_code: "EUR",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: endDate.toISOString(),
        },
        next_billed_at: endDate.toISOString(),
        billing_cycle: {
          interval: "year",
          frequency: 1,
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter);
      assert.ok(supporter.paddleCustomer);
      assert.strictEqual(supporter.paddleCustomer.customerId, "ctm_123");
      assert.strictEqual(supporter.paddleCustomer.email, billingEmail);
      assert.strictEqual(supporter.paddleCustomer.lastCurrencyCodeUsed, "EUR");
      assert.ok(supporter.paddleCustomer.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.productKey,
        SubscriptionProductKey.Tier1,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.status,
        SubscriptionStatus.Active,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.billingInterval,
        "year",
      );
    });

    it("correctly calculates benefits including extra feeds addon", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProduct: async (productId: string) => {
            if (productId === "prod-tier3") {
              return {
                paddleProductId: productId,
                id: SubscriptionProductKey.Tier3,
              };
            }
            return {
              paddleProductId: productId,
              id: SubscriptionProductKey.Tier3AdditionalFeed,
            };
          },
        },
      });
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        items: [
          { quantity: 1, price: { id: "price-1", product_id: "prod-tier3" } },
          { quantity: 10, price: { id: "price-2", product_id: "prod-addon" } },
        ],
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.maxUserFeeds,
        140 + 10,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.addons?.length,
        1,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.addons?.[0]?.key,
        SubscriptionProductKey.Tier3AdditionalFeed,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.addons?.[0]?.quantity,
        10,
      );
    });

    it('sets cancellation date when scheduled_change action is "cancel"', async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser();
      const now = new Date();
      const endDate = dayjs(now).add(1, "month").toDate();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: endDate.toISOString(),
        },
        scheduled_change: {
          action: "cancel",
          resume_at: null,
          effective_at: endDate.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription?.cancellationDate);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.cancellationDate.getTime(),
        endDate.getTime(),
      );
    });

    it("calls enforceUserFeedLimit after upsert", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      assert.strictEqual(
        ctx.userFeedsService.enforceUserFeedLimit.mock.callCount(),
        1,
      );
      assert.strictEqual(
        ctx.userFeedsService.enforceUserFeedLimit.mock.calls[0]?.arguments[0],
        user.discordUserId,
      );
    });

    it("calls syncDiscordSupporterRoles after upsert (error-safe)", async () => {
      const ctx = harness.createContext({
        supportersService: {
          syncDiscordSupporterRoles: async () => {
            throw new Error("Discord API error");
          },
        },
      });
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await assert.doesNotReject(() =>
        ctx.service.handleSubscriptionUpdatedEvent(event),
      );
    });

    it("maps past_due status correctly", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        status: PaddleSubscriptionStatus.PastDue,
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.status,
        SubscriptionStatus.PastDue,
      );
    });

    it("maps paused status correctly", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        status: PaddleSubscriptionStatus.Paused,
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.status,
        SubscriptionStatus.Paused,
      );
    });

    it("correctly sets month billing interval", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        billing_cycle: {
          interval: "month",
          frequency: 1,
        },
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.billingInterval,
        "month",
      );
    });

    it("correctly applies Tier2 benefits", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProduct: async () => ({
            paddleProductId: "prod-tier2",
            id: SubscriptionProductKey.Tier2,
          }),
        },
      });
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.productKey,
        SubscriptionProductKey.Tier2,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.maxUserFeeds,
        70,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.refreshRateSeconds,
        120,
      );
    });

    it("correctly applies Tier1Legacy benefits", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProduct: async () => ({
            paddleProductId: "prod-tier1-legacy",
            id: LegacySubscriptionProductKey.Tier1Legacy,
          }),
        },
      });
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.maxUserFeeds,
        5,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.refreshRateSeconds,
        600,
      );
    });

    it("correctly applies Tier3Legacy benefits", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProduct: async () => ({
            paddleProductId: "prod-tier3-legacy",
            id: LegacySubscriptionProductKey.Tier3Legacy,
          }),
        },
      });
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.maxUserFeeds,
        35,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.refreshRateSeconds,
        120,
      );
    });

    it("correctly applies Tier6Legacy benefits", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProduct: async () => ({
            paddleProductId: "prod-tier6-legacy",
            id: LegacySubscriptionProductKey.Tier6Legacy,
          }),
        },
      });
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.maxUserFeeds,
        140,
      );
      assert.strictEqual(
        supporter.paddleCustomer.subscription.benefits.refreshRateSeconds,
        120,
      );
    });

    it("sets nextBillDate to null when not provided", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        next_billed_at: null,
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.nextBillDate,
        null,
      );
    });

    it("does not set cancellationDate when no scheduled_change", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser();
      const now = new Date();

      const event = ctx.createSubscriptionUpdatedEvent({
        custom_data: { userId: user.id },
        scheduled_change: null,
        current_billing_period: {
          starts_at: now.toISOString(),
          ends_at: now.toISOString(),
        },
      });

      await ctx.service.handleSubscriptionUpdatedEvent(event);

      const supporter = await ctx.supporterRepository.findById(
        user.discordUserId,
      );
      assert.ok(supporter?.paddleCustomer?.subscription);
      assert.strictEqual(
        supporter.paddleCustomer.subscription.cancellationDate,
        null,
      );
    });
  });

  describe("handleSubscriptionCancelledEvent", () => {
    it("nullifies subscription by subscription ID", async () => {
      const ctx = harness.createContext();
      const subscriptionId = ctx.generateId();
      const discordUserId = ctx.generateId();

      await ctx.createSupporter({
        id: discordUserId,
        paddleCustomer: {
          customerId: ctx.generateId(),
          email: "test@test.com",
          lastCurrencyCodeUsed: "USD",
          subscription: {
            id: subscriptionId,
            productKey: SubscriptionProductKey.Tier1,
            status: SubscriptionStatus.Active,
            currencyCode: "USD",
            billingPeriodStart: new Date(),
            billingPeriodEnd: dayjs().add(1, "month").toDate(),
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

      const event = ctx.createSubscriptionCanceledEvent({ id: subscriptionId });

      await ctx.service.handleSubscriptionCancelledEvent(event);

      const supporter = await ctx.supporterRepository.findById(discordUserId);
      assert.ok(supporter?.paddleCustomer);
      assert.strictEqual(supporter.paddleCustomer.subscription, null);
    });

    it("does nothing when supporter not found", async () => {
      const ctx = harness.createContext();
      const event = ctx.createSubscriptionCanceledEvent();

      await assert.doesNotReject(() =>
        ctx.service.handleSubscriptionCancelledEvent(event),
      );

      assert.strictEqual(
        ctx.userFeedsService.enforceUserFeedLimit.mock.callCount(),
        0,
      );
      assert.strictEqual(
        ctx.supportersService.syncDiscordSupporterRoles.mock.callCount(),
        0,
      );
    });

    it("calls enforceUserFeedLimit when supporter found", async () => {
      const ctx = harness.createContext();
      const subscriptionId = ctx.generateId();
      const discordUserId = ctx.generateId();

      await ctx.createSupporter({
        id: discordUserId,
        paddleCustomer: {
          customerId: ctx.generateId(),
          email: "test@test.com",
          lastCurrencyCodeUsed: "USD",
          subscription: {
            id: subscriptionId,
            productKey: SubscriptionProductKey.Tier1,
            status: SubscriptionStatus.Active,
            currencyCode: "USD",
            billingPeriodStart: new Date(),
            billingPeriodEnd: dayjs().add(1, "month").toDate(),
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

      const event = ctx.createSubscriptionCanceledEvent({ id: subscriptionId });

      await ctx.service.handleSubscriptionCancelledEvent(event);

      assert.strictEqual(
        ctx.userFeedsService.enforceUserFeedLimit.mock.callCount(),
        1,
      );
      assert.strictEqual(
        ctx.userFeedsService.enforceUserFeedLimit.mock.calls[0]?.arguments[0],
        discordUserId,
      );
    });

    it("calls syncDiscordSupporterRoles when supporter found (error-safe)", async () => {
      const ctx = harness.createContext({
        supportersService: {
          syncDiscordSupporterRoles: async () => {
            throw new Error("Discord API error");
          },
        },
      });
      const subscriptionId = ctx.generateId();
      const discordUserId = ctx.generateId();

      await ctx.createSupporter({
        id: discordUserId,
        paddleCustomer: {
          customerId: ctx.generateId(),
          email: "test@test.com",
          lastCurrencyCodeUsed: "USD",
          subscription: {
            id: subscriptionId,
            productKey: SubscriptionProductKey.Tier1,
            status: SubscriptionStatus.Active,
            currencyCode: "USD",
            billingPeriodStart: new Date(),
            billingPeriodEnd: dayjs().add(1, "month").toDate(),
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

      const event = ctx.createSubscriptionCanceledEvent({ id: subscriptionId });

      await assert.doesNotReject(() =>
        ctx.service.handleSubscriptionCancelledEvent(event),
      );
    });
  });
});
