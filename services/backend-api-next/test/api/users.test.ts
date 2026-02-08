import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateSnowflake, generateTestId } from "../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../helpers/test-http-server";
import type { MockApi } from "../helpers/mock-apis";
import {
  SubscriptionProductKey,
  SubscriptionStatus,
} from "../../src/repositories/shared/enums";

interface UserResponse {
  result: {
    id: string;
    discordUserId: string;
    email?: string;
    preferences: Record<string, unknown>;
    subscription: {
      product: { key: string; name: string };
      status: string;
    };
    creditBalance: { availableFormatted: string };
    enableBilling: boolean;
    featureFlags: Record<string, unknown>;
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

describe("GET /api/v1/users/@me", { concurrency: true }, () => {
  describe("Authentication", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch("/api/v1/users/@me");
      assert.strictEqual(response.status, 401);
    });
  });

  describe("Authenticated user without email", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_ENABLE_SUPPORTERS: true,
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns user profile with free subscription when user has no email", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          id: string;
          discordUserId: string;
          email?: string;
          preferences: Record<string, unknown>;
          subscription: {
            product: { key: string; name: string };
            status: string;
          };
          creditBalance: { availableFormatted: string };
          enableBilling: boolean;
          featureFlags: Record<string, unknown>;
          supporterFeatures: {
            exrternalProperties: { enabled: boolean };
          };
          externalAccounts: Array<{ type: string; status: string }>;
        };
      };

      assert.ok(body.result);
      assert.strictEqual(body.result.discordUserId, discordUserId);
      assert.strictEqual(body.result.email, undefined);
      assert.deepStrictEqual(body.result.preferences, {});
      assert.strictEqual(body.result.subscription.product.key, "free");
      assert.strictEqual(body.result.subscription.product.name, "Free");
      assert.strictEqual(
        body.result.subscription.status,
        SubscriptionStatus.Active,
      );
      assert.strictEqual(body.result.creditBalance.availableFormatted, "0");
      assert.strictEqual(body.result.enableBilling, true);
      assert.deepStrictEqual(body.result.featureFlags, {});
      assert.ok(body.result.supporterFeatures);
      assert.strictEqual(
        body.result.supporterFeatures.exrternalProperties.enabled,
        false,
      );
      assert.ok(Array.isArray(body.result.externalAccounts));
    });
  });

  describe(
    "Authenticated user with Paddle subscription",
    { concurrency: true },
    () => {
      let ctx: AppTestContext;
      let paddleApi: MockApi & { server: TestHttpServer };

      before(async () => {
        paddleApi = createMockPaddleApi();
        ctx = await createAppTestContext({
          configOverrides: {
            BACKEND_API_ENABLE_SUPPORTERS: true,
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

      it("returns user profile with active subscription details", async () => {
        const discordUserId = generateSnowflake();
        const customerId = generateTestId();

        await ctx.container.userRepository.create({
          discordUserId,
          email: `${discordUserId}@test.com`,
        });

        const billingPeriodStart = new Date("2025-01-01");
        const billingPeriodEnd = new Date("2025-02-01");

        await ctx.container.supporterRepository.create({
          id: discordUserId,
          guilds: [],
          paddleCustomer: {
            customerId,
            email: `${discordUserId}@billing.com`,
            lastCurrencyCodeUsed: "USD",
            subscription: {
              id: generateTestId(),
              productKey: SubscriptionProductKey.Tier1,
              status: SubscriptionStatus.Active,
              currencyCode: "USD",
              billingPeriodStart,
              billingPeriodEnd,
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
          "GET",
          `/customers/${customerId}/credit-balances`,
          {
            status: 200,
            body: {
              data: [
                {
                  currency_code: "USD",
                  balance: {
                    available: "500",
                    reserved: "0",
                    used: "0",
                  },
                },
              ],
            },
          },
        );

        const user = await ctx.asUser(discordUserId);
        const response = await user.fetch("/api/v1/users/@me");

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: {
            id: string;
            discordUserId: string;
            email: string;
            subscription: {
              product: { key: string; name: string };
              status: string;
              billingInterval: string;
              billingPeriod: { start: string; end: string };
            };
            creditBalance: { availableFormatted: string };
            enableBilling: boolean;
          };
        };

        assert.ok(body.result);
        assert.strictEqual(body.result.discordUserId, discordUserId);
        assert.strictEqual(body.result.email, `${discordUserId}@test.com`);
        assert.strictEqual(body.result.subscription.product.key, "tier1");
        assert.strictEqual(body.result.subscription.product.name, "Tier 1");
        assert.strictEqual(
          body.result.subscription.status,
          SubscriptionStatus.Active,
        );
        assert.strictEqual(body.result.subscription.billingInterval, "month");
        assert.ok(body.result.subscription.billingPeriod);
        assert.strictEqual(body.result.creditBalance.availableFormatted, "$5");
        assert.strictEqual(body.result.enableBilling, true);
      });
    },
  );

  describe(
    "Authenticated user with supporter (manual)",
    { concurrency: true },
    () => {
      let ctx: AppTestContext;

      before(async () => {
        ctx = await createAppTestContext({
          configOverrides: {
            BACKEND_API_ENABLE_SUPPORTERS: true,
          },
        });
      });

      after(async () => {
        await ctx.teardown();
      });

      it("returns user profile with free subscription for manual supporter", async () => {
        const discordUserId = generateSnowflake();

        await ctx.container.userRepository.create({
          discordUserId,
          email: `${discordUserId}@test.com`,
        });

        await ctx.container.supporterRepository.create({
          id: discordUserId,
          guilds: [],
          maxFeeds: 50,
          maxGuilds: 5,
          expireAt: new Date("2030-12-31"),
        });

        const user = await ctx.asUser(discordUserId);
        const response = await user.fetch("/api/v1/users/@me");

        assert.strictEqual(response.status, 200);
        const body = (await response.json()) as {
          result: {
            discordUserId: string;
            email: string;
            subscription: {
              product: { key: string; name: string };
            };
            creditBalance: { availableFormatted: string };
          };
        };

        assert.ok(body.result);
        assert.strictEqual(body.result.discordUserId, discordUserId);
        assert.strictEqual(body.result.email, `${discordUserId}@test.com`);
        assert.strictEqual(body.result.subscription.product.key, "free");
        assert.strictEqual(body.result.creditBalance.availableFormatted, "0");
      });
    },
  );
});

describe("PATCH /api/v1/users/@me", { concurrency: true }, () => {
  describe("Authentication", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({ preferences: { alertOnDisabledFeeds: true } }),
        headers: { "Content-Type": "application/json" },
      });
      assert.strictEqual(response.status, 401);
    });
  });

  describe("Validation", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_ENABLE_SUPPORTERS: true,
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("strips unknown preference fields and succeeds", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { unknownField: "value" },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
    });

    it("strips unknown nested fields in feedListSort and succeeds", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            feedListSort: { key: "title", direction: "asc", unknownField: "x" },
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
    });

    it("returns 400 for invalid timezone", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { dateTimezone: "Invalid/Timezone" },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for invalid locale", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { dateLocale: "invalid-locale-xyz" },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for invalid feedListSort.key", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            feedListSort: { key: "invalidKey", direction: "asc" },
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for invalid feedListSort.direction", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { feedListSort: { key: "title", direction: "invalid" } },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 with descriptive message when all columns are hidden", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            feedListColumnVisibility: {
              computedStatus: false,
              title: false,
              url: false,
              createdAt: false,
              ownedByUser: false,
              refreshRateSeconds: false,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as {
        code: string;
        errors: Array<{ message: string }>;
      };
      assert.strictEqual(body.code, "VALIDATION_FAILED");
      assert.ok(body.errors.length > 0);
      assert.ok(
        body.errors.some((e) =>
          e.message.includes("At least one column must be visible"),
        ),
      );
    });

    it("returns 400 for invalid status filter value", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            feedListStatusFilters: { statuses: ["INVALID_STATUS"] },
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 400);
    });
  });

  describe("Success cases", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_ENABLE_SUPPORTERS: true,
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("updates alertOnDisabledFeeds preference", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { alertOnDisabledFeeds: true },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      assert.strictEqual(body.result.preferences.alertOnDisabledFeeds, true);
    });

    it("updates dateFormat preference", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { dateFormat: "YYYY-MM-DD HH:mm" },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      assert.strictEqual(
        body.result.preferences.dateFormat,
        "YYYY-MM-DD HH:mm",
      );
    });

    it("updates dateTimezone preference with valid timezone", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { dateTimezone: "America/New_York" },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      assert.strictEqual(
        body.result.preferences.dateTimezone,
        "America/New_York",
      );
    });

    it("updates dateLocale preference with valid locale", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { dateLocale: "en-gb" },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      assert.strictEqual(body.result.preferences.dateLocale, "en-gb");
    });

    it("updates feedListSort preference", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { feedListSort: { key: "title", direction: "desc" } },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      const sort = body.result.preferences.feedListSort as {
        key: string;
        direction: string;
      };
      assert.strictEqual(sort.key, "title");
      assert.strictEqual(sort.direction, "desc");
    });

    it("clears feedListSort preference with null", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { feedListSort: { key: "title", direction: "asc" } },
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { feedListSort: null },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      assert.strictEqual(body.result.preferences.feedListSort, undefined);
    });

    it("updates feedListColumnVisibility preference", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            feedListColumnVisibility: {
              title: true,
              url: false,
              computedStatus: true,
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      const visibility = body.result.preferences.feedListColumnVisibility as {
        title: boolean;
        url: boolean;
        computedStatus: boolean;
      };
      assert.strictEqual(visibility.title, true);
      assert.strictEqual(visibility.url, false);
      assert.strictEqual(visibility.computedStatus, true);
    });

    it("updates feedListColumnOrder preference", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            feedListColumnOrder: {
              columns: ["title", "url", "createdAt"],
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      const order = body.result.preferences.feedListColumnOrder as {
        columns: string[];
      };
      assert.deepStrictEqual(order.columns, ["title", "url", "createdAt"]);
    });

    it("updates feedListStatusFilters preference", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            feedListStatusFilters: {
              statuses: ["OK", "REQUIRES_ATTENTION"],
            },
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      const filters = body.result.preferences.feedListStatusFilters as {
        statuses: string[];
      };
      assert.deepStrictEqual(filters.statuses, ["OK", "REQUIRES_ATTENTION"]);
    });

    it("updates multiple preferences at once", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            alertOnDisabledFeeds: true,
            dateFormat: "DD/MM/YYYY",
            dateTimezone: "Europe/London",
            dateLocale: "en-gb",
          },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;
      assert.strictEqual(body.result.preferences.alertOnDisabledFeeds, true);
      assert.strictEqual(body.result.preferences.dateFormat, "DD/MM/YYYY");
      assert.strictEqual(body.result.preferences.dateTimezone, "Europe/London");
      assert.strictEqual(body.result.preferences.dateLocale, "en-gb");
    });

    it("returns full user response format after update", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const response = await user.fetch("/api/v1/users/@me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { alertOnDisabledFeeds: true },
        }),
        headers: { "Content-Type": "application/json" },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as UserResponse;

      assert.ok(body.result.id);
      assert.strictEqual(body.result.discordUserId, discordUserId);
      assert.ok(body.result.subscription);
      assert.ok(body.result.subscription.product);
      assert.ok(body.result.creditBalance);
      assert.ok(typeof body.result.enableBilling === "boolean");
      assert.ok(body.result.featureFlags);
    });
  });
});
