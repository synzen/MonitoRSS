import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import fetch, { RequestInit } from "node-fetch";
import { URLSearchParams } from "url";
import { formatCurrency } from "../../utils/format-currency";
import { SupportersService } from "../supporters/supporters.service";
import { User, UserModel } from "../users/entities/user.entity";
import { SubscriptionProductKey } from "./constants/subscription-product-key.constants";
import { PaddleCustomerResponse } from "./types/paddle-customer-response.type";
import { PaddlePricingPreviewResponse } from "./types/paddle-pricing-preview-response.type";
import {
  PaddleProductResponse,
  PaddleProductsResponse,
} from "./types/paddle-products-response.type";
import { PaddleSubscriptionPreviewResponse } from "./types/paddle-subscription-preview-response.type";

const PRODUCT_NAMES: Record<SubscriptionProductKey, string> = {
  [SubscriptionProductKey.Free]: "Free",
  [SubscriptionProductKey.Tier1]: "Tier 1",
  [SubscriptionProductKey.Tier2]: "Tier 2",
  [SubscriptionProductKey.Tier3]: "Tier 3",
};

@Injectable()
export class SupporterSubscriptionsService {
  PADDLE_URL?: string;
  PADDLE_KEY?: string;
  PRODUCT_IDS: Array<{ id: string; name: string }> = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    @InjectModel(User.name) private readonly userModel: UserModel
  ) {
    this.PADDLE_URL = configService.get("BACKEND_API_PADDLE_URL");
    this.PADDLE_KEY = configService.get("BACKEND_API_PADDLE_KEY");
  }

  async getEmailFromDiscordUserId(discordUserId: string) {
    const user = await this.userModel.findOne({ discordUserId }).lean();

    return user?.email || null;
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

    const pricesByProduct: Partial<
      Record<
        SubscriptionProductKey,
        {
          name: string;
          prices: Array<{
            id: string;
            interval: "month" | "year";
            formattedPrice: string;
            currencyCode: string;
          }>;
        }
      >
    > = {
      [SubscriptionProductKey.Free]: {
        name: "Free",
        prices: [
          {
            id: "free-monthly",
            interval: "month",
            formattedPrice: formatCurrency("0", currency),
            currencyCode: currency,
          },
          {
            id: "free-yearly",
            interval: "year",
            formattedPrice: formatCurrency("0", currency),
            currencyCode: currency,
          },
        ],
      },
    };

    for (const {
      formatted_totals,
      product,
      price: { billing_cycle, id: priceId },
    } of previewData.data.details.line_items) {
      const useProductId = product.custom_data?.key as SubscriptionProductKey;

      if (!billing_cycle || !useProductId) {
        continue;
      }

      const formattedPrice = {
        id: priceId,
        interval: billing_cycle.interval,
        formattedPrice: formatted_totals.total,
        currencyCode: currency,
      };

      const prices = pricesByProduct[useProductId]?.prices;

      if (!prices) {
        pricesByProduct[useProductId] = {
          name: PRODUCT_NAMES[useProductId],
          prices: [formattedPrice],
        };
      } else {
        prices.push(formattedPrice);
      }
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

  async getProduct(productId: string) {
    const response = await this.executeApiCall<PaddleProductResponse>(
      `/products/${productId}`
    );

    if (!response.data.custom_data?.key) {
      throw new Error(
        `Paddle Product ${productId} does not have a custom_data.key set`
      );
    }

    return {
      id: response.data.custom_data?.key as SubscriptionProductKey | undefined,
    };
  }

  async getCustomer(id: string) {
    const response = await this.executeApiCall<PaddleCustomerResponse>(
      `/customers/${id}`
    );

    return {
      email: response.data.email,
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
    const { subscription } =
      await this.supportersService.getSupporterSubscription(email);

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const postBody = {
      items: items.map((i) => ({
        price_id: i.priceId,
        quantity: i.quantity,
      })),
      currency_code: currencyCode,
      proration_billing_mode: "prorated_immediately",
    };

    const response =
      await this.executeApiCall<PaddleSubscriptionPreviewResponse>(
        `/subscriptions/${existingSubscriptionId}/preview`,
        {
          method: "PATCH",
          body: JSON.stringify(postBody),
        }
      );

    if (!response.data.immediate_transaction) {
      throw new Error(
        `Failed to get immediate transaction from preview response (check proration billing mode)`
      );
    }

    const immediateTransaction = response.data.immediate_transaction;

    return {
      immediateTransaction: {
        billingPeriod: {
          startsAt: immediateTransaction.billing_period.starts_at,
          endsAt: immediateTransaction.billing_period.ends_at,
        },
        subtotal: immediateTransaction.details.totals.subtotal,
        subtotalFormatted: formatCurrency(
          immediateTransaction.details.totals.subtotal,
          currencyCode
        ),
        tax: immediateTransaction.details.totals.tax,
        taxFormatted: formatCurrency(
          immediateTransaction.details.totals.tax,
          currencyCode
        ),
        credit: immediateTransaction.details.totals.credit,
        creditFormatted: formatCurrency(
          immediateTransaction.details.totals.credit,
          currencyCode
        ),
        total: immediateTransaction.details.totals.total,
        totalFormatted: formatCurrency(
          immediateTransaction.details.totals.total,
          currencyCode
        ),
        grandTotal: immediateTransaction.details.totals.grand_total,
        grandTotalFormatted: formatCurrency(
          immediateTransaction.details.totals.grand_total,
          currencyCode
        ),
      },
    };
  }

  async changeSubscription({
    email,
    items,
    currencyCode,
  }: {
    email: string;
    items: Array<{ priceId: string; quantity: number }>;
    currencyCode: string;
  }) {
    const { subscription } =
      await this.supportersService.getSupporterSubscription(email);

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const postBody = {
      items: items.map((i) => ({
        price_id: i.priceId,
        quantity: i.quantity,
      })),
      currency_code: currencyCode,
      proration_billing_mode: "prorated_immediately",
    };

    await this.executeApiCall<PaddleSubscriptionPreviewResponse>(
      `/subscriptions/${existingSubscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(postBody),
      }
    );
  }

  async cancelSubscription({ email }: { email: string }) {
    const { subscription } =
      await this.supportersService.getSupporterSubscription(email);

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const postBody = {
      effective_from: "next_billing_period",
    };

    await this.executeApiCall<PaddleSubscriptionPreviewResponse>(
      `/subscriptions/${existingSubscriptionId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(postBody),
      }
    );
  }

  async resumeSubscription({ email }: { email: string }) {
    const { subscription } =
      await this.supportersService.getSupporterSubscription(email);

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const body = {
      scheduled_change: null,
    };

    await this.executeApiCall<PaddleSubscriptionPreviewResponse>(
      `/subscriptions/${existingSubscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );
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
