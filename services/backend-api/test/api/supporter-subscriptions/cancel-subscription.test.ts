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
  "GET /api/v1/subscription-products/cancel",
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
          "/api/v1/subscription-products/cancel",
          {
            method: "GET",
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

      it("returns 400 when user has no email", async () => {
        const discordUserId = generateTestId();
        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/cancel",
          {
            method: "GET",
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
          "/api/v1/subscription-products/cancel",
          {
            method: "GET",
          },
        );

        assert.strictEqual(response.status, 500);
      });

      it("returns 204 when subscription is cancelled successfully", async () => {
        const discordUserId = generateTestId();
        const subscriptionId = generateTestId();
        const customerId = generateTestId();

        await ctx.container.userRepository.create({
          discordUserId,
          email: `${discordUserId}@test.com`,
        });

        await ctx.container.supporterRepository.create({
          id: discordUserId,
          guilds: [],
          paddleCustomer: {
            customerId,
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
          "POST",
          `/subscriptions/${subscriptionId}/cancel`,
          {
            status: 200,
            body: {
              data: {
                id: subscriptionId,
                status: "active",
                scheduled_change: {
                  action: "cancel",
                  effective_at: new Date(
                    Date.now() + 30 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                },
              },
            },
          },
        );

        setTimeout(async () => {
          await ctx.container.supporterRepository.upsertPaddleCustomer(
            discordUserId,
            {
              customerId,
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
                cancellationDate: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                ),
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
          );
        }, 500);

        const user = await ctx.asUser(discordUserId);

        const response = await user.fetch(
          "/api/v1/subscription-products/cancel",
          {
            method: "GET",
          },
        );

        assert.strictEqual(response.status, 204);
      });
    });
  },
);
