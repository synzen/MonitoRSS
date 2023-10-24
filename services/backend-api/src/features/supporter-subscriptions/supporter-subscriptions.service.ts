import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import fetch, { RequestInit } from "node-fetch";
import { URLSearchParams } from "url";
import { PaddlePricingPreviewResponse } from "./types/paddle-pricing-preview-response.type";
import { PaddleProductsResponse } from "./types/paddle-products-response.type";
import { PaddleSubscriptionPreviewResponse } from "./types/paddle-subscription-preview-response.type";

@Injectable()
export class SupporterSubscriptionsService {
  PADDLE_URL?: string;
  PADDLE_KEY?: string;
  PRODUCT_IDS: Array<{ id: string; name: string }> = [];

  constructor(private readonly configService: ConfigService) {
    this.PADDLE_URL = configService.get("BACKEND_API_PADDLE_URL");
    this.PADDLE_KEY = configService.get("BACKEND_API_PADDLE_KEY");
  }

  async getProductCurrencies(currency: string) {
    const { products } = await this.getProducts();

    const priceIds = products.flatMap((d) => {
      return d.prices.map((p) => {
        return p.id;
      });
    });

    const payload = {
      items: priceIds.map((id) => ({
        price_id: id,
        quantity: 1,
      })),
      currency_code: currency,
    };

    const previewData = await this.executeApiCall<PaddlePricingPreviewResponse>(
      `/pricing-preview`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    const pricesByProduct: Record<
      string,
      {
        prices: Array<{
          id: string;
          interval: "month" | "year";
          formattedPrice: string;
          currencyCode: string;
        }>;
      }
    > = {};

    for (const {
      formatted_totals,
      product,
      price: { billing_cycle, id },
    } of previewData.data.details.line_items) {
      const useProductId = product.custom_data?.key;

      if (!billing_cycle || !useProductId) {
        continue;
      }

      if (!pricesByProduct[useProductId]) {
        pricesByProduct[useProductId] = { prices: [] };
      }

      pricesByProduct[useProductId].prices.push({
        id,
        interval: billing_cycle.interval,
        formattedPrice: formatted_totals.total,
        currencyCode: currency,
      });
    }

    return {
      products: pricesByProduct,
    };
  }

  async getProducts() {
    const searchParams = new URLSearchParams({
      status: "active",
      include: "prices",
    });

    const response = await this.executeApiCall<PaddleProductsResponse>(
      `/products?${searchParams.toString()}`
    );

    return {
      products: response.data
        .filter((p) => !!p.custom_data?.key)
        .map((p) => ({
          id: p.custom_data?.key as string,
          name: p.name,
          prices: p.prices.map((p) => ({
            id: p.id,
          })),
        })),
    };
  }

  async previewSubscriptionChange({
    email,
    items,
    currencyCode,
  }: {
    email: string;
    items: Array<{ priceId: string; quantity: number }>;
    currencyCode: string;
  }) {
    const postBody = {
      items: items.map((i) => ({
        price_id: i.priceId,
        quantity: i.quantity,
      })),
      currency_code: currencyCode,
      proration_billing_mode: "prorated_immediately",
    };

    const existingSubscriptionId = "PLACEHOLDER";

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const response =
      await this.executeApiCall<PaddleSubscriptionPreviewResponse>(
        `/subscriptions/${existingSubscriptionId}/preview`,
        {
          method: "POST",
          body: JSON.stringify(postBody),
        }
      );

    if (!response.data.immediate_transaction) {
      throw new Error(
        `Failed to get immediate transaction from preview response (check proration billing mode)`
      );
    }

    return {
      immediateTransaction: {
        billingPeriod: {
          startsAt:
            response.data.immediate_transaction.billing_period.starts_at,
          endsAt: response.data.immediate_transaction.billing_period.ends_at,
        },
        subtotal: response.data.immediate_transaction.details.totals.subtotal,
        tax: response.data.immediate_transaction.details.totals.tax,
        credit: response.data.immediate_transaction.details.totals.credit,
        total: response.data.immediate_transaction.details.totals.total,
        grandTotal: response.data.immediate_transaction.details.totals,
      },
    };
  }

  async executeApiCall<T>(endpoint: string, data?: RequestInit): Promise<T> {
    if (!this.PADDLE_KEY || !this.PADDLE_URL) {
      throw new Error(
        "Paddle key or paddle URL not set when executing api request to paddle products"
      );
    }

    const url = `${this.PADDLE_URL}${endpoint}`;

    const res = await fetch(url, {
      ...data,
      headers: {
        ...data?.headers,
        Authorization: `Bearer ${this.PADDLE_KEY}`,
      },
    });

    if (!res.ok) {
      let responseJson = null;

      try {
        responseJson = JSON.stringify(await res.json());
      } catch (err) {}

      throw new Error(
        `Failed to make Paddle request (${url}) due to bad status code: ${res.status}. Response: ${responseJson}`
      );
    }

    return res.json();
  }
}
