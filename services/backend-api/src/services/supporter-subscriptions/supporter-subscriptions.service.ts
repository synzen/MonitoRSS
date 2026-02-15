import type { Config } from "../../config";
import type { IUserRepository } from "../../repositories/interfaces/user.types";
import { formatCurrency } from "../../utils/format-currency";
import type { MessageBrokerService } from "../message-broker/message-broker.service";
import type { PaddleService } from "../paddle/paddle.service";
import { SubscriptionProductKey } from "../paddle/types";
import type { SupportersService } from "../supporters/supporters.service";
import {
  PRODUCT_NAMES,
  PRODUCT_KEYS_BY_PLEDGE,
  SUBSCRIPTION_PRODUCT_KEYS,
} from "./constants";
import type {
  PaddlePricingPreviewResponse,
  PaddleSubscriptionPreviewResponse,
  PaddleSubscriptionUpdatePaymentMethodResponse,
} from "./types";

export interface SupporterSubscriptionsServiceDeps {
  config: Config;
  supportersService: SupportersService;
  userRepository: IUserRepository;
  messageBrokerService: MessageBrokerService;
  paddleService: PaddleService;
}

export class SupporterSubscriptionsService {
  constructor(private readonly deps: SupporterSubscriptionsServiceDeps) {}

  async getEmailFromDiscordUserId(
    discordUserId: string,
  ): Promise<string | null> {
    const user = await this.deps.userRepository.findByDiscordId(discordUserId);

    return user?.email || null;
  }

  async getConversionPriceIdsFromPatreon({
    pledge,
  }: {
    pledge: number;
  }): Promise<{ monthlyPriceId: string; yearlyPriceId: string }> {
    const productKey = PRODUCT_KEYS_BY_PLEDGE[String(pledge)];

    if (!productKey) {
      throw new Error(`No price key found for pledge amount ${pledge}`);
    }

    const products = await this.deps.paddleService.getProducts();

    const relevantProduct = products.products.filter(
      (p) => p.customData?.key === productKey,
    );

    if (relevantProduct.length === 0) {
      throw new Error(`No product found for key ${productKey}`);
    }

    const relevantProductPrices = relevantProduct[0]!.prices;
    const monthlyPriceId = relevantProductPrices.find(
      (p) => p.billingCycle?.interval === "month",
    )?.id;
    const yearlyPriceId = relevantProductPrices.find(
      (p) => p.billingCycle?.interval === "year",
    )?.id;

    if (!monthlyPriceId || !yearlyPriceId) {
      throw new Error(
        `No monthly or yearly price found for product ${productKey}`,
      );
    }

    return {
      monthlyPriceId,
      yearlyPriceId,
    };
  }

  async getProductCurrencies(
    currency: string,
    data: { ipAddress?: string },
  ): Promise<{
    products: Partial<
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
    >;
  }> {
    const paddleKey = this.deps.config.BACKEND_API_PADDLE_KEY;

    if (!paddleKey) {
      return {
        products: {},
      };
    }

    const { products } = await this.deps.paddleService.getProducts();

    const priceIds = products
      .filter(
        (p) =>
          p.customData?.key &&
          SUBSCRIPTION_PRODUCT_KEYS.includes(
            p.customData.key as SubscriptionProductKey,
          ),
      )
      .flatMap((d) => {
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
      customer_ip_address: data.ipAddress || "",
    };

    const previewData =
      await this.deps.paddleService.executeApiCall<PaddlePricingPreviewResponse>(
        `/pricing-preview`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
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
        name: "Free Tier",
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

  async previewSubscriptionChange({
    discordUserId,
    items,
  }: {
    discordUserId: string;
    items: Array<{ priceId: string; quantity: number }>;
  }): Promise<{
    immediateTransaction: {
      billingPeriod: {
        startsAt: string;
        endsAt: string;
      };
      subtotal: string;
      subtotalFormatted: string;
      tax: string;
      taxFormatted: string;
      credit: string;
      creditFormatted: string;
      total: string;
      totalFormatted: string;
      grandTotal: string;
      grandTotalFormatted: string;
    };
  }> {
    const { subscription } =
      await this.deps.supportersService.getSupporterSubscription({
        discordUserId,
      });

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const postBody = {
      items: items.map((i) => ({
        price_id: i.priceId,
        quantity: i.quantity,
      })),
      currency_code: subscription.currencyCode,
      proration_billing_mode: "prorated_immediately",
    };

    const response =
      await this.deps.paddleService.executeApiCall<PaddleSubscriptionPreviewResponse>(
        `/subscriptions/${existingSubscriptionId}/preview`,
        {
          method: "PATCH",
          body: JSON.stringify(postBody),
        },
      );

    if (!response.data.immediate_transaction) {
      throw new Error(
        `Failed to get immediate transaction from preview response (check proration billing mode)`,
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
          subscription.currencyCode,
        ),
        tax: immediateTransaction.details.totals.tax,
        taxFormatted: formatCurrency(
          immediateTransaction.details.totals.tax,
          subscription.currencyCode,
        ),
        credit: immediateTransaction.details.totals.credit,
        creditFormatted: formatCurrency(
          immediateTransaction.details.totals.credit,
          subscription.currencyCode,
        ),
        total: immediateTransaction.details.totals.total,
        totalFormatted: formatCurrency(
          immediateTransaction.details.totals.total,
          subscription.currencyCode,
        ),
        grandTotal: immediateTransaction.details.totals.grand_total,
        grandTotalFormatted: formatCurrency(
          immediateTransaction.details.totals.grand_total,
          subscription.currencyCode,
        ),
      },
    };
  }

  async changeSubscription({
    discordUserId,
    items,
  }: {
    discordUserId: string;
    items: Array<{ priceId: string; quantity: number }>;
  }): Promise<void> {
    const { subscription } =
      await this.deps.supportersService.getSupporterSubscription({
        discordUserId,
      });

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const postBody = {
      items: items.map((i) => ({
        price_id: i.priceId,
        quantity: i.quantity,
      })),
      currency_code: subscription.currencyCode,
      proration_billing_mode: "prorated_immediately",
    };

    await this.deps.paddleService.executeApiCall<PaddleSubscriptionPreviewResponse>(
      `/subscriptions/${existingSubscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(postBody),
      },
    );

    const currentUpdatedAt = subscription.updatedAt.getTime();

    await this.pollForSubscriptionChange({
      discordUserId,
      check: (sub) => {
        const latestUpdatedAt = sub.subscription?.updatedAt;

        return (
          !!latestUpdatedAt && latestUpdatedAt.getTime() > currentUpdatedAt
        );
      },
    });

    if (discordUserId) {
      this.deps.messageBrokerService.publishSyncSupporterDiscordRoles({
        userId: discordUserId,
      });
    }
  }

  async cancelSubscription({
    discordUserId,
  }: {
    discordUserId: string;
  }): Promise<void> {
    const { subscription } =
      await this.deps.supportersService.getSupporterSubscription({
        discordUserId,
      });

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const postBody = {
      effective_from: "next_billing_period",
    };

    await this.deps.paddleService.executeApiCall<PaddleSubscriptionPreviewResponse>(
      `/subscriptions/${existingSubscriptionId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(postBody),
      },
    );

    await this.pollForSubscriptionChange({
      discordUserId,
      check: (sub) => {
        const cancellationDate = sub.subscription?.cancellationDate;

        return !!cancellationDate;
      },
    });
  }

  async resumeSubscription({
    discordUserId,
  }: {
    discordUserId: string;
  }): Promise<void> {
    const { subscription } =
      await this.deps.supportersService.getSupporterSubscription({
        discordUserId,
      });

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error("No existing subscription for user found");
    }

    const body = {
      scheduled_change: null,
    };

    await this.deps.paddleService.executeApiCall<PaddleSubscriptionPreviewResponse>(
      `/subscriptions/${existingSubscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );

    await this.pollForSubscriptionChange({
      discordUserId,
      check: (sub) => {
        const cancellationDate = sub.subscription?.cancellationDate;

        return !cancellationDate;
      },
    });
  }

  async getUpdatePaymentMethodTransaction({
    discordUserId,
  }: {
    discordUserId: string;
  }): Promise<{ id: string }> {
    const { subscription } =
      await this.deps.supportersService.getSupporterSubscription({
        discordUserId,
      });

    const existingSubscriptionId = subscription?.id;

    if (!existingSubscriptionId) {
      throw new Error(
        "No existing subscription for user found while getting update payment method transaction",
      );
    }

    const response =
      await this.deps.paddleService.executeApiCall<PaddleSubscriptionUpdatePaymentMethodResponse>(
        `/subscriptions/${existingSubscriptionId}/update-payment-method-transaction`,
      );

    return {
      id: response.data.id,
    };
  }

  private async pollForSubscriptionChange({
    discordUserId,
    check,
  }: {
    discordUserId: string;
    check: (
      sub: Awaited<ReturnType<SupportersService["getSupporterSubscription"]>>,
    ) => boolean;
  }): Promise<void> {
    let tries = 0;

    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    while (true) {
      const subscription =
        await this.deps.supportersService.getSupporterSubscription({
          discordUserId,
        });

      if (check(subscription)) {
        break;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 1000));

      tries++;

      if (tries > 50) {
        throw new Error("Failed to poll for subscription after 10 tries");
      }
    }
  }
}
