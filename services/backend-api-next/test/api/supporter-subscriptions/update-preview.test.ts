import { describe, it, before, after } from "node:test";
import assert from "node:assert";
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

describe(
  "POST /api/v1/subscription-products/update-preview",
  { concurrency: true },
  () => {
    describe("Authentication", { concurrency: true }, () => {
      let ctx: AppTestContext;

      before(async () => {
        ctx = await createAppTestContext();
      });

      after(async () => {
        await ctx.teardown();
      });

      it("returns 401 when not authenticated", async () => {
        const response = await ctx.fetch(
          "/api/v1/subscription-products/update-preview",
          {
            method: "POST",
            body: JSON.stringify({ priceId: "price_123" }),
            headers: { "Content-Type": "application/json" },
          },
        );

        assert.strictEqual(response.status, 401);
      });
    });

    describe("Authenticated user", { concurrency: true }, () => {
      let ctx: AppTestContext;
      let paddleApi: MockApi & { server: TestHttpServer };

      before(async () => {
        paddleApi = createMockPaddleApi();
        ctx = await createAppTestContext({
          configOverrides: {
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

      it("returns 400 when neither priceId nor prices provided", async () => {
        const discordUserId = generateTestId();
        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/update-preview",
          {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "Content-Type": "application/json" },
          },
        );

        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(body.code, "INVALID_REQUEST");
      });

      it("returns 400 when user has no email", async () => {
        const discordUserId = generateTestId();
        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/update-preview",
          {
            method: "POST",
            body: JSON.stringify({ priceId: "price_123" }),
            headers: { "Content-Type": "application/json" },
          },
        );

        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(body.code, "INVALID_REQUEST");
      });

      it("returns 500 when user has no subscription", async () => {
        const discordUserId = generateTestId();

        await ctx.container.userRepository.create({
          discordUserId,
          email: `${discordUserId}@test.com`,
        });

        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/update-preview",
          {
            method: "POST",
            body: JSON.stringify({ priceId: "price_123" }),
            headers: { "Content-Type": "application/json" },
          },
        );

        assert.strictEqual(response.status, 500);
      });

      it("returns 200 with preview data using priceId", async () => {
        const discordUserId = generateTestId();
        const subscriptionId = generateTestId();

        await ctx.container.userRepository.create({
          discordUserId,
          email: `${discordUserId}@test.com`,
        });

        await ctx.container.supporterRepository.create({
          id: discordUserId,
          guilds: [],
          paddleCustomer: {
            customerId: generateTestId(),
            email: `${discordUserId}@billing.com`,
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

        paddleApi.server.registerRoute(
          "PATCH",
          `/subscriptions/${subscriptionId}/preview`,
          {
            status: 200,
            body: {
              data: {
                immediate_transaction: {
                  billing_period: {
                    starts_at: "2024-01-01T00:00:00Z",
                    ends_at: "2024-02-01T00:00:00Z",
                  },
                  details: {
                    totals: {
                      subtotal: "1000",
                      tax: "100",
                      credit: "500",
                      total: "600",
                      grand_total: "600",
                    },
                  },
                },
              },
            },
          },
        );

        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/update-preview",
          {
            method: "POST",
            body: JSON.stringify({ priceId: "price_new_tier" }),
            headers: { "Content-Type": "application/json" },
          },
        );

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          data: {
            immediateTransaction: {
              billingPeriod: { startsAt: string; endsAt: string };
              subtotal: string;
              total: string;
              credit: string;
            };
          };
        };
        assert.ok(body.data);
        assert.ok(body.data.immediateTransaction);
        assert.strictEqual(
          body.data.immediateTransaction.billingPeriod.startsAt,
          "2024-01-01T00:00:00Z",
        );
        assert.strictEqual(body.data.immediateTransaction.subtotal, "1000");
        assert.strictEqual(body.data.immediateTransaction.credit, "500");
        assert.strictEqual(body.data.immediateTransaction.total, "600");
      });

      it("returns 200 with preview data using prices array", async () => {
        const discordUserId = generateTestId();
        const subscriptionId = generateTestId();

        await ctx.container.userRepository.create({
          discordUserId,
          email: `${discordUserId}@test.com`,
        });

        await ctx.container.supporterRepository.create({
          id: discordUserId,
          guilds: [],
          paddleCustomer: {
            customerId: generateTestId(),
            email: `${discordUserId}@billing.com`,
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

        paddleApi.server.registerRoute(
          "PATCH",
          `/subscriptions/${subscriptionId}/preview`,
          {
            status: 200,
            body: {
              data: {
                immediate_transaction: {
                  billing_period: {
                    starts_at: "2024-01-01T00:00:00Z",
                    ends_at: "2024-02-01T00:00:00Z",
                  },
                  details: {
                    totals: {
                      subtotal: "2000",
                      tax: "200",
                      credit: "800",
                      total: "1400",
                      grand_total: "1400",
                    },
                  },
                },
              },
            },
          },
        );

        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/update-preview",
          {
            method: "POST",
            body: JSON.stringify({
              prices: [
                { priceId: "price_tier3", quantity: 1 },
                { priceId: "price_additional_feed", quantity: 5 },
              ],
            }),
            headers: { "Content-Type": "application/json" },
          },
        );

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          data: {
            immediateTransaction: {
              billingPeriod: { startsAt: string; endsAt: string };
              subtotal: string;
              total: string;
            };
          };
        };
        assert.ok(body.data);
        assert.ok(body.data.immediateTransaction);
        assert.strictEqual(body.data.immediateTransaction.subtotal, "2000");
        assert.strictEqual(body.data.immediateTransaction.total, "1400");
      });

      it("returns 400 with TRANSACTION_BALANCE_TOO_LOW when Paddle returns balance too low error", async () => {
        const discordUserId = generateTestId();
        const subscriptionId = generateTestId();

        await ctx.container.userRepository.create({
          discordUserId,
          email: `${discordUserId}@test.com`,
        });

        await ctx.container.supporterRepository.create({
          id: discordUserId,
          guilds: [],
          paddleCustomer: {
            customerId: generateTestId(),
            email: `${discordUserId}@billing.com`,
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

        paddleApi.server.registerRoute(
          "PATCH",
          `/subscriptions/${subscriptionId}/preview`,
          {
            status: 400,
            body: {
              error: {
                code: "subscription_update_transaction_balance_less_than_charge_limit",
                detail: "Transaction balance is less than minimum required",
              },
            },
          },
        );

        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/update-preview",
          {
            method: "POST",
            body: JSON.stringify({ priceId: "price_downgrade" }),
            headers: { "Content-Type": "application/json" },
          },
        );

        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(body.code, "TRANSACTION_BALANCE_TOO_LOW");
      });

      it("returns 400 with SUBSCRIPTION_ABOUT_TO_RENEW when subscription is locked for renewal", async () => {
        const discordUserId = generateTestId();
        const subscriptionId = generateTestId();

        await ctx.container.userRepository.create({
          discordUserId,
          email: `${discordUserId}@test.com`,
        });

        await ctx.container.supporterRepository.create({
          id: discordUserId,
          guilds: [],
          paddleCustomer: {
            customerId: generateTestId(),
            email: `${discordUserId}@billing.com`,
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

        paddleApi.server.registerRoute(
          "PATCH",
          `/subscriptions/${subscriptionId}/preview`,
          {
            status: 400,
            body: {
              error: {
                code: "subscription_locked_renewal",
                detail: "Subscription is locked for renewal",
              },
            },
          },
        );

        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/update-preview",
          {
            method: "POST",
            body: JSON.stringify({ priceId: "price_change" }),
            headers: { "Content-Type": "application/json" },
          },
        );

        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(body.code, "SUBSCRIPTION_ABOUT_TO_RENEW");
      });
    });
  },
);
