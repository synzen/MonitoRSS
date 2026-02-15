import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createSupporterSubscriptionsHarness } from "../helpers/supporter-subscriptions.harness";
import { SubscriptionProductKey } from "../../src/services/paddle/types";
import type {
  PaddlePricingPreviewResponse,
  PaddleSubscriptionPreviewResponse,
  PaddleSubscriptionUpdatePaymentMethodResponse,
} from "../../src/services/supporter-subscriptions/types";

describe("SupporterSubscriptionsService", { concurrency: true }, () => {
  const harness = createSupporterSubscriptionsHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("getEmailFromDiscordUserId", () => {
    it("returns email when user exists", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser({ email: "test@example.com" });

      const result = await ctx.service.getEmailFromDiscordUserId(
        user.discordUserId,
      );

      assert.strictEqual(result, "test@example.com");
    });

    it("returns null when user not found", async () => {
      const ctx = harness.createContext();

      const result = await ctx.service.getEmailFromDiscordUserId(
        ctx.generateId(),
      );

      assert.strictEqual(result, null);
    });

    it("returns null when user exists but has no email", async () => {
      const ctx = harness.createContext();
      const user = await ctx.createUser({ email: undefined });

      const result = await ctx.service.getEmailFromDiscordUserId(
        user.discordUserId,
      );

      assert.strictEqual(result, null);
    });
  });

  describe("getConversionPriceIdsFromPatreon", () => {
    it("returns price IDs for valid pledge amount", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProducts: async () => ({
            products: [
              {
                id: "prod-123",
                name: "Tier 1 Legacy",
                prices: [
                  {
                    id: "price-monthly",
                    billingCycle: { interval: "month" as const, frequency: 1 },
                  },
                  {
                    id: "price-yearly",
                    billingCycle: { interval: "year" as const, frequency: 1 },
                  },
                ],
                customData: { key: "tier1-legacy" },
              },
            ],
          }),
        },
      });

      const result = await ctx.service.getConversionPriceIdsFromPatreon({
        pledge: 100,
      });

      assert.strictEqual(result.monthlyPriceId, "price-monthly");
      assert.strictEqual(result.yearlyPriceId, "price-yearly");
    });

    it("throws for invalid pledge amount", async () => {
      const ctx = harness.createContext();

      await assert.rejects(
        () => ctx.service.getConversionPriceIdsFromPatreon({ pledge: 999 }),
        {
          message: "No price key found for pledge amount 999",
        },
      );
    });

    it("throws when no product found for pledge", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProducts: async () => ({
            products: [],
          }),
        },
      });

      await assert.rejects(
        () => ctx.service.getConversionPriceIdsFromPatreon({ pledge: 100 }),
        {
          message: "No product found for key tier1-legacy",
        },
      );
    });

    it("throws when no monthly or yearly price found", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProducts: async () => ({
            products: [
              {
                id: "prod-123",
                name: "Tier 1 Legacy",
                prices: [],
                customData: { key: "tier1-legacy" },
              },
            ],
          }),
        },
      });

      await assert.rejects(
        () => ctx.service.getConversionPriceIdsFromPatreon({ pledge: 100 }),
        {
          message: "No monthly or yearly price found for product tier1-legacy",
        },
      );
    });
  });

  describe("getProductCurrencies", () => {
    it("returns empty products when no Paddle key", async () => {
      const ctx = harness.createContext({
        config: { BACKEND_API_PADDLE_KEY: undefined },
      });

      const result = await ctx.service.getProductCurrencies("USD", {});

      assert.deepStrictEqual(result, { products: {} });
    });

    it("returns products with formatted prices", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProducts: async () => ({
            products: [
              {
                id: "tier1",
                name: "Tier 1",
                prices: [{ id: "price-1", billingCycle: null }],
                customData: { key: "tier1" },
              },
            ],
          }),
          executeApiCall: async <T>(): Promise<T> => {
            const response: PaddlePricingPreviewResponse = {
              data: {
                currency_code: "USD",
                details: {
                  line_items: [
                    {
                      price: {
                        id: "price-1",
                        billing_cycle: { frequency: 1, interval: "month" },
                      },
                      formatted_totals: { total: "$5.00" },
                      product: {
                        id: "prod-1",
                        custom_data: { key: "tier1" },
                      },
                    },
                  ],
                },
              },
            };
            return response as T;
          },
        },
      });

      const result = await ctx.service.getProductCurrencies("USD", {});

      assert.ok(result.products[SubscriptionProductKey.Free]);
      assert.ok(result.products[SubscriptionProductKey.Tier1]);
      assert.strictEqual(
        result.products[SubscriptionProductKey.Tier1]!.name,
        "Tier 1",
      );
      assert.strictEqual(
        result.products[SubscriptionProductKey.Tier1]!.prices[0]
          ?.formattedPrice,
        "$5.00",
      );
    });

    it("includes Free tier in products", async () => {
      const ctx = harness.createContext({
        paddleService: {
          getProducts: async () => ({
            products: [],
          }),
          executeApiCall: async <T>(): Promise<T> => {
            const response: PaddlePricingPreviewResponse = {
              data: {
                currency_code: "USD",
                details: {
                  line_items: [],
                },
              },
            };
            return response as T;
          },
        },
      });

      const result = await ctx.service.getProductCurrencies("USD", {});

      assert.ok(result.products[SubscriptionProductKey.Free]);
      assert.strictEqual(
        result.products[SubscriptionProductKey.Free]!.name,
        "Free Tier",
      );
      assert.strictEqual(
        result.products[SubscriptionProductKey.Free]!.prices.length,
        2,
      );
    });
  });

  describe("previewSubscriptionChange", () => {
    it("returns formatted preview", async () => {
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => ({
            discordUserId: "user-1",
            customer: { id: "cust-1", currencyCode: "USD" },
            subscription: {
              id: "sub-123",
              currencyCode: "USD",
              updatedAt: new Date(),
            },
          }),
        },
        paddleService: {
          executeApiCall: async <T>(): Promise<T> => {
            const response: PaddleSubscriptionPreviewResponse = {
              data: {
                immediate_transaction: {
                  billing_period: {
                    starts_at: "2024-01-01T00:00:00Z",
                    ends_at: "2024-02-01T00:00:00Z",
                  },
                  details: {
                    line_items: [],
                    totals: {
                      subtotal: "1000",
                      tax: "100",
                      total: "1100",
                      credit: "500",
                      grand_total: "600",
                      balance: "600",
                    },
                  },
                },
              },
            };
            return response as T;
          },
        },
      });

      const result = await ctx.service.previewSubscriptionChange({
        discordUserId: "user-1",
        items: [{ priceId: "price-1", quantity: 1 }],
      });

      assert.strictEqual(result.immediateTransaction.subtotal, "1000");
      assert.strictEqual(result.immediateTransaction.subtotalFormatted, "$10");
      assert.strictEqual(result.immediateTransaction.tax, "100");
      assert.strictEqual(result.immediateTransaction.taxFormatted, "$1");
      assert.strictEqual(result.immediateTransaction.credit, "500");
      assert.strictEqual(result.immediateTransaction.creditFormatted, "$5");
      assert.strictEqual(result.immediateTransaction.grandTotal, "600");
      assert.strictEqual(result.immediateTransaction.grandTotalFormatted, "$6");
    });

    it("throws when no subscription exists", async () => {
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => ({
            discordUserId: undefined,
            customer: null,
            subscription: null,
          }),
        },
      });

      await assert.rejects(
        () =>
          ctx.service.previewSubscriptionChange({
            discordUserId: "user-1",
            items: [{ priceId: "price-1", quantity: 1 }],
          }),
        {
          message: "No existing subscription for user found",
        },
      );
    });

    it("throws when immediate_transaction is null", async () => {
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => ({
            discordUserId: "user-1",
            customer: { id: "cust-1", currencyCode: "USD" },
            subscription: {
              id: "sub-123",
              currencyCode: "USD",
              updatedAt: new Date(),
            },
          }),
        },
        paddleService: {
          executeApiCall: async <T>(): Promise<T> => {
            const response: PaddleSubscriptionPreviewResponse = {
              data: {
                immediate_transaction: null,
              },
            };
            return response as T;
          },
        },
      });

      await assert.rejects(
        () =>
          ctx.service.previewSubscriptionChange({
            discordUserId: "user-1",
            items: [{ priceId: "price-1", quantity: 1 }],
          }),
        {
          message:
            "Failed to get immediate transaction from preview response (check proration billing mode)",
        },
      );
    });
  });

  describe("changeSubscription", () => {
    it("applies change and publishes sync message", async () => {
      let callCount = 0;
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => {
            callCount++;
            return {
              discordUserId: "user-1",
              customer: { id: "cust-1", currencyCode: "USD" },
              subscription: {
                id: "sub-123",
                currencyCode: "USD",
                updatedAt:
                  callCount === 1
                    ? new Date("2024-01-01")
                    : new Date("2024-01-02"),
              },
            };
          },
        },
        paddleService: {
          executeApiCall: async <T>(): Promise<T> => ({}) as T,
        },
      });

      await ctx.service.changeSubscription({
        discordUserId: "user-1",
        items: [{ priceId: "price-1", quantity: 1 }],
      });

      assert.strictEqual(
        ctx.messageBrokerService.publishSyncSupporterDiscordRoles.mock.callCount(),
        1,
      );
      assert.deepStrictEqual(
        ctx.messageBrokerService.publishSyncSupporterDiscordRoles.mock.calls[0]
          ?.arguments[0],
        { userId: "user-1" },
      );
    });

    it("throws when no subscription exists", async () => {
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => ({
            discordUserId: undefined,
            customer: null,
            subscription: null,
          }),
        },
      });

      await assert.rejects(
        () =>
          ctx.service.changeSubscription({
            discordUserId: "user-1",
            items: [{ priceId: "price-1", quantity: 1 }],
          }),
        {
          message: "No existing subscription for user found",
        },
      );
    });
  });

  describe("cancelSubscription", () => {
    it("cancels and polls for cancellation date", async () => {
      let callCount = 0;
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => {
            callCount++;
            return {
              discordUserId: "user-1",
              customer: { id: "cust-1", currencyCode: "USD" },
              subscription: {
                id: "sub-123",
                currencyCode: "USD",
                updatedAt: new Date(),
                cancellationDate:
                  callCount === 1 ? null : new Date("2024-02-01"),
              },
            };
          },
        },
        paddleService: {
          executeApiCall: async <T>(): Promise<T> => ({}) as T,
        },
      });

      await ctx.service.cancelSubscription({ discordUserId: "user-1" });

      assert.ok(callCount >= 2);
    });

    it("throws when no subscription exists", async () => {
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => ({
            discordUserId: undefined,
            customer: null,
            subscription: null,
          }),
        },
      });

      await assert.rejects(
        () => ctx.service.cancelSubscription({ discordUserId: "user-1" }),
        {
          message: "No existing subscription for user found",
        },
      );
    });
  });

  describe("resumeSubscription", () => {
    it("resumes and polls for cleared cancellation", async () => {
      let callCount = 0;
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => {
            callCount++;
            return {
              discordUserId: "user-1",
              customer: { id: "cust-1", currencyCode: "USD" },
              subscription: {
                id: "sub-123",
                currencyCode: "USD",
                updatedAt: new Date(),
                cancellationDate:
                  callCount === 1 ? new Date("2024-02-01") : null,
              },
            };
          },
        },
        paddleService: {
          executeApiCall: async <T>(): Promise<T> => ({}) as T,
        },
      });

      await ctx.service.resumeSubscription({ discordUserId: "user-1" });

      assert.ok(callCount >= 2);
    });

    it("throws when no subscription exists", async () => {
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => ({
            discordUserId: undefined,
            customer: null,
            subscription: null,
          }),
        },
      });

      await assert.rejects(
        () => ctx.service.resumeSubscription({ discordUserId: "user-1" }),
        {
          message: "No existing subscription for user found",
        },
      );
    });
  });

  describe("getUpdatePaymentMethodTransaction", () => {
    it("returns transaction ID", async () => {
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => ({
            discordUserId: "user-1",
            customer: { id: "cust-1", currencyCode: "USD" },
            subscription: {
              id: "sub-123",
              currencyCode: "USD",
              updatedAt: new Date(),
            },
          }),
        },
        paddleService: {
          executeApiCall: async <T>(): Promise<T> => {
            const response: PaddleSubscriptionUpdatePaymentMethodResponse = {
              data: { id: "txn-456" },
            };
            return response as T;
          },
        },
      });

      const result = await ctx.service.getUpdatePaymentMethodTransaction({
        discordUserId: "user-1",
      });

      assert.strictEqual(result.id, "txn-456");
    });

    it("throws when no subscription exists", async () => {
      const ctx = harness.createContext({
        supportersService: {
          getSupporterSubscription: async () => ({
            discordUserId: undefined,
            customer: null,
            subscription: null,
          }),
        },
      });

      await assert.rejects(
        () =>
          ctx.service.getUpdatePaymentMethodTransaction({
            discordUserId: "user-1",
          }),
        {
          message:
            "No existing subscription for user found while getting update payment method transaction",
        },
      );
    });
  });
});
