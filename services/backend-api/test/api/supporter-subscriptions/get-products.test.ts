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
import { SubscriptionProductKey } from "../../../src/services/paddle/types";

interface ProductPrice {
  id: string;
  interval: string;
  formattedPrice: string;
  currencyCode: string;
}

interface Product {
  id: string;
  name: string;
  prices: ProductPrice[];
}

interface GetProductsResponse {
  data: {
    products: Product[];
    currencies: Array<{ code: string; symbol: string }>;
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

describe("GET /api/v1/subscription-products", { concurrency: true }, () => {
  describe("Without Paddle configured", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_KEY: undefined,
          BACKEND_API_PADDLE_URL: undefined,
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 200 with empty products array when Paddle is not configured", async () => {
      const response = await ctx.fetch("/api/v1/subscription-products/");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetProductsResponse;

      assert.ok(body.data);
      assert.ok(Array.isArray(body.data.products));
      assert.strictEqual(body.data.products.length, 0);
      assert.ok(Array.isArray(body.data.currencies));
      assert.ok(body.data.currencies.length > 0);
    });

    it("returns currencies with correct symbols", async () => {
      const response = await ctx.fetch("/api/v1/subscription-products/");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetProductsResponse;

      const audCurrency = body.data.currencies.find((c) => c.code === "AUD");
      assert.ok(audCurrency);
      assert.strictEqual(audCurrency.symbol, "AU$");

      const usdCurrency = body.data.currencies.find((c) => c.code === "USD");
      assert.ok(usdCurrency);
      assert.strictEqual(usdCurrency.symbol, "$");

      const gbpCurrency = body.data.currencies.find((c) => c.code === "GBP");
      assert.ok(gbpCurrency);
      assert.strictEqual(gbpCurrency.symbol, "£");
    });
  });

  describe("With Paddle configured", { concurrency: false }, () => {
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

    it("returns 200 with products array and currencies in data wrapper", async () => {
      const tier1ProductId = generateTestId();
      const tier1MonthlyPriceId = generateTestId();
      const tier1YearlyPriceId = generateTestId();

      paddleApi.server.registerRoute("GET", "/products", {
        status: 200,
        body: {
          data: [
            {
              id: tier1ProductId,
              name: "Tier 1",
              custom_data: { key: SubscriptionProductKey.Tier1 },
              prices: [
                {
                  id: tier1MonthlyPriceId,
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "month" },
                },
                {
                  id: tier1YearlyPriceId,
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "year" },
                },
              ],
            },
          ],
        },
      });

      paddleApi.server.registerRoute("POST", "/pricing-preview", {
        status: 200,
        body: {
          data: {
            currency_code: "USD",
            details: {
              line_items: [
                {
                  price: {
                    id: tier1MonthlyPriceId,
                    billing_cycle: { frequency: 1, interval: "month" },
                  },
                  formatted_totals: { total: "$5.00" },
                  product: {
                    id: tier1ProductId,
                    custom_data: { key: SubscriptionProductKey.Tier1 },
                  },
                },
                {
                  price: {
                    id: tier1YearlyPriceId,
                    billing_cycle: { frequency: 1, interval: "year" },
                  },
                  formatted_totals: { total: "$50.00" },
                  product: {
                    id: tier1ProductId,
                    custom_data: { key: SubscriptionProductKey.Tier1 },
                  },
                },
              ],
            },
          },
        },
      });

      const response = await ctx.fetch("/api/v1/subscription-products/");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetProductsResponse;

      assert.ok(body.data);
      assert.ok(Array.isArray(body.data.products));
      assert.ok(Array.isArray(body.data.currencies));

      const freeProduct = body.data.products.find(
        (p) => p.id === SubscriptionProductKey.Free,
      );
      const tier1Product = body.data.products.find(
        (p) => p.id === SubscriptionProductKey.Tier1,
      );

      assert.ok(freeProduct);
      assert.ok(tier1Product);
      assert.strictEqual(tier1Product.name, "Tier 1");

      assert.strictEqual(tier1Product.prices.length, 2);

      const monthlyPrice = tier1Product.prices.find(
        (p) => p.interval === "month",
      );
      const yearlyPrice = tier1Product.prices.find(
        (p) => p.interval === "year",
      );
      assert.ok(monthlyPrice);
      assert.ok(yearlyPrice);
      assert.strictEqual(monthlyPrice.formattedPrice, "$5.00");
      assert.strictEqual(yearlyPrice.formattedPrice, "$50.00");

      const usdCurrency = body.data.currencies.find((c) => c.code === "USD");
      assert.ok(usdCurrency);
      assert.strictEqual(usdCurrency.symbol, "$");
    });

    it("includes Free tier with $0 prices", async () => {
      paddleApi.server.registerRoute("GET", "/products", {
        status: 200,
        body: {
          data: [],
        },
      });

      const response = await ctx.fetch("/api/v1/subscription-products/");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetProductsResponse;

      const freeProduct = body.data.products.find(
        (p) => p.id === SubscriptionProductKey.Free,
      );
      assert.ok(freeProduct);
      assert.strictEqual(freeProduct.name, "Free Tier");
      assert.strictEqual(freeProduct.prices.length, 2);

      const monthlyFree = freeProduct.prices.find(
        (p) => p.interval === "month",
      );
      const yearlyFree = freeProduct.prices.find((p) => p.interval === "year");
      assert.ok(monthlyFree);
      assert.ok(yearlyFree);
      assert.strictEqual(monthlyFree.formattedPrice, "$0");
      assert.strictEqual(yearlyFree.formattedPrice, "$0");
      assert.strictEqual(monthlyFree.id, "free-monthly");
      assert.strictEqual(yearlyFree.id, "free-yearly");
    });

    it("uses currency query parameter", async () => {
      const tier1ProductId = generateTestId();
      const tier1MonthlyPriceId = generateTestId();

      paddleApi.server.registerRoute("GET", "/products", {
        status: 200,
        body: {
          data: [
            {
              id: tier1ProductId,
              name: "Tier 1",
              custom_data: { key: SubscriptionProductKey.Tier1 },
              prices: [
                {
                  id: tier1MonthlyPriceId,
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "month" },
                },
              ],
            },
          ],
        },
      });

      paddleApi.server.registerRoute("POST", "/pricing-preview", {
        status: 200,
        body: {
          data: {
            currency_code: "EUR",
            details: {
              line_items: [
                {
                  price: {
                    id: tier1MonthlyPriceId,
                    billing_cycle: { frequency: 1, interval: "month" },
                  },
                  formatted_totals: { total: "€4.50" },
                  product: {
                    id: tier1ProductId,
                    custom_data: { key: SubscriptionProductKey.Tier1 },
                  },
                },
              ],
            },
          },
        },
      });

      const response = await ctx.fetch(
        "/api/v1/subscription-products/?currency=EUR",
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetProductsResponse;

      const freeProduct = body.data.products.find(
        (p) => p.id === SubscriptionProductKey.Free,
      );
      assert.ok(freeProduct);
      const monthlyFree = freeProduct.prices.find(
        (p) => p.interval === "month",
      );
      assert.ok(monthlyFree);
      assert.strictEqual(monthlyFree.currencyCode, "EUR");
      assert.strictEqual(monthlyFree.formattedPrice, "€0");
    });

    it("returns 400 for invalid currency code", async () => {
      const response = await ctx.fetch(
        "/api/v1/subscription-products/?currency=INVALID",
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 with ADDRESS_LOCATION_NOT_ALLOWED when Paddle returns location error", async () => {
      paddleApi.server.registerRoute("GET", "/products", {
        status: 200,
        body: {
          data: [
            {
              id: generateTestId(),
              name: "Tier 1",
              custom_data: { key: SubscriptionProductKey.Tier1 },
              prices: [
                {
                  id: generateTestId(),
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "month" },
                },
              ],
            },
          ],
        },
      });

      paddleApi.server.registerRoute("POST", "/pricing-preview", {
        status: 400,
        body: {
          error: {
            code: "address_location_not_allowed",
            detail: "Location not allowed",
          },
        },
      });

      const response = await ctx.fetch("/api/v1/subscription-products/");

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "ADDRESS_LOCATION_NOT_ALLOWED");
    });

    it("filters out non-subscription products", async () => {
      const tier1ProductId = generateTestId();
      const legacyProductId = generateTestId();
      const tier1PriceId = generateTestId();

      paddleApi.server.registerRoute("GET", "/products", {
        status: 200,
        body: {
          data: [
            {
              id: tier1ProductId,
              name: "Tier 1",
              custom_data: { key: SubscriptionProductKey.Tier1 },
              prices: [
                {
                  id: tier1PriceId,
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "month" },
                },
              ],
            },
            {
              id: legacyProductId,
              name: "Legacy Tier",
              custom_data: { key: "tier1-legacy" },
              prices: [
                {
                  id: generateTestId(),
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "month" },
                },
              ],
            },
          ],
        },
      });

      paddleApi.server.registerRoute("POST", "/pricing-preview", {
        status: 200,
        body: {
          data: {
            currency_code: "USD",
            details: {
              line_items: [
                {
                  price: {
                    id: tier1PriceId,
                    billing_cycle: { frequency: 1, interval: "month" },
                  },
                  formatted_totals: { total: "$5.00" },
                  product: {
                    id: tier1ProductId,
                    custom_data: { key: SubscriptionProductKey.Tier1 },
                  },
                },
              ],
            },
          },
        },
      });

      const response = await ctx.fetch("/api/v1/subscription-products/");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetProductsResponse;

      const tier1Product = body.data.products.find(
        (p) => p.id === SubscriptionProductKey.Tier1,
      );
      const legacyProduct = body.data.products.find(
        (p) => p.id === "tier1-legacy",
      );

      assert.ok(tier1Product);
      assert.strictEqual(legacyProduct, undefined);
    });

    it("rejects lowercase currency parameter (case-sensitive)", async () => {
      const response = await ctx.fetch(
        "/api/v1/subscription-products/?currency=usd",
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects mixed-case currency parameter", async () => {
      const response = await ctx.fetch(
        "/api/v1/subscription-products/?currency=Eur",
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns currencies in alphabetical order", async () => {
      paddleApi.server.registerRoute("GET", "/products", {
        status: 200,
        body: { data: [] },
      });

      const response = await ctx.fetch("/api/v1/subscription-products/");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetProductsResponse;

      const currencyCodes = body.data.currencies.map((c) => c.code);
      const sortedCodes = [...currencyCodes].sort((a, b) => a.localeCompare(b));
      assert.deepStrictEqual(
        currencyCodes,
        sortedCodes,
        "Currencies should be in alphabetical order",
      );
    });

    it("sends customer_ip_address to Paddle pricing-preview", async () => {
      const tier1ProductId = generateTestId();
      const tier1PriceId = generateTestId();

      paddleApi.server.registerRoute("GET", "/products", {
        status: 200,
        body: {
          data: [
            {
              id: tier1ProductId,
              name: "Tier 1",
              custom_data: { key: SubscriptionProductKey.Tier1 },
              prices: [
                {
                  id: tier1PriceId,
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "month" },
                },
              ],
            },
          ],
        },
      });

      paddleApi.server.registerRoute("POST", "/pricing-preview", {
        status: 200,
        body: {
          data: {
            currency_code: "USD",
            details: {
              line_items: [
                {
                  price: {
                    id: tier1PriceId,
                    billing_cycle: { frequency: 1, interval: "month" },
                  },
                  formatted_totals: { total: "$5.00" },
                  product: {
                    id: tier1ProductId,
                    custom_data: { key: SubscriptionProductKey.Tier1 },
                  },
                },
              ],
            },
          },
        },
      });

      await ctx.fetch("/api/v1/subscription-products/");

      const pricingPreviewRequests =
        paddleApi.server.getRequestsForPath("/pricing-preview");
      assert.ok(pricingPreviewRequests.length > 0);

      const lastRequest =
        pricingPreviewRequests[pricingPreviewRequests.length - 1];
      assert.ok(lastRequest);
      const capturedBody = lastRequest.body as Record<string, unknown>;
      assert.ok(capturedBody);
      assert.ok(
        "customer_ip_address" in capturedBody,
        "customer_ip_address should be in the request body",
      );
    });

    it("returns products as array with id property (not object)", async () => {
      const tier1ProductId = generateTestId();
      const tier2ProductId = generateTestId();
      const tier1PriceId = generateTestId();
      const tier2PriceId = generateTestId();

      paddleApi.server.registerRoute("GET", "/products", {
        status: 200,
        body: {
          data: [
            {
              id: tier1ProductId,
              name: "Tier 1",
              custom_data: { key: SubscriptionProductKey.Tier1 },
              prices: [
                {
                  id: tier1PriceId,
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "month" },
                },
              ],
            },
            {
              id: tier2ProductId,
              name: "Tier 2",
              custom_data: { key: SubscriptionProductKey.Tier2 },
              prices: [
                {
                  id: tier2PriceId,
                  status: "active",
                  billing_cycle: { frequency: 1, interval: "month" },
                },
              ],
            },
          ],
        },
      });

      paddleApi.server.registerRoute("POST", "/pricing-preview", {
        status: 200,
        body: {
          data: {
            currency_code: "USD",
            details: {
              line_items: [
                {
                  price: {
                    id: tier1PriceId,
                    billing_cycle: { frequency: 1, interval: "month" },
                  },
                  formatted_totals: { total: "$5.00" },
                  product: {
                    id: tier1ProductId,
                    custom_data: { key: SubscriptionProductKey.Tier1 },
                  },
                },
                {
                  price: {
                    id: tier2PriceId,
                    billing_cycle: { frequency: 1, interval: "month" },
                  },
                  formatted_totals: { total: "$10.00" },
                  product: {
                    id: tier2ProductId,
                    custom_data: { key: SubscriptionProductKey.Tier2 },
                  },
                },
              ],
            },
          },
        },
      });

      const response = await ctx.fetch("/api/v1/subscription-products/");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetProductsResponse;

      assert.ok(Array.isArray(body.data.products));

      for (const product of body.data.products) {
        assert.ok(
          typeof product.id === "string",
          "Each product should have an id string",
        );
        assert.ok(
          typeof product.name === "string",
          "Each product should have a name string",
        );
        assert.ok(
          Array.isArray(product.prices),
          "Each product should have a prices array",
        );
      }

      const productIds = body.data.products.map((p) => p.id);
      assert.ok(productIds.includes(SubscriptionProductKey.Free));
      assert.ok(productIds.includes(SubscriptionProductKey.Tier1));
      assert.ok(productIds.includes(SubscriptionProductKey.Tier2));
    });
  });
});
