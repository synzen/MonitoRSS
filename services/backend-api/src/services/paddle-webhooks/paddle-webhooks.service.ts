import { createHmac } from "crypto";
import logger from "../../infra/logger";
import {
  WORKSPACE_BASE_TIER_KEYS,
  WORKSPACE_TIER_FEED_LIMITS,
} from "../../shared/utils/billing";
import {
  SubscriptionProductKey,
  LegacySubscriptionProductKey,
  SubscriptionStatus,
} from "../../repositories/shared/enums";
import type { IPaddleCustomerBenefits } from "../../repositories/interfaces/supporter.types";
import {
  PaddleSubscriptionStatus,
  type PaddleWebhooksServiceDeps,
  type PaddleEventSubscriptionUpdated,
  type PaddleEventSubscriptionActivated,
  type PaddleEventSubscriptionCanceled,
} from "./types";

type TierBenefits = IPaddleCustomerBenefits;

const BENEFITS_BY_TIER: Partial<
  Record<SubscriptionProductKey | LegacySubscriptionProductKey, TierBenefits>
> = {
  [SubscriptionProductKey.Tier1]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 35,
    refreshRateSeconds: 120,
  },
  [SubscriptionProductKey.Tier2]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: WORKSPACE_TIER_FEED_LIMITS[SubscriptionProductKey.Tier2],
    refreshRateSeconds: 120,
  },
  [SubscriptionProductKey.Tier3]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: WORKSPACE_TIER_FEED_LIMITS[SubscriptionProductKey.Tier3],
    refreshRateSeconds: 120,
  },
  [LegacySubscriptionProductKey.Tier1Legacy]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 5,
    refreshRateSeconds: 600,
  },
  [LegacySubscriptionProductKey.Tier2Legacy]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 15,
    refreshRateSeconds: 600,
  },
  [LegacySubscriptionProductKey.Tier3Legacy]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 35,
    refreshRateSeconds: 120,
  },
  [LegacySubscriptionProductKey.Tier4Legacy]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 70,
    refreshRateSeconds: 120,
  },
  [LegacySubscriptionProductKey.Tier5Legacy]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 105,
    refreshRateSeconds: 120,
  },
  [LegacySubscriptionProductKey.Tier6Legacy]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 140,
    refreshRateSeconds: 120,
  },
};

const SUBSCRIPTION_STATUS_MAPPING: Record<
  PaddleSubscriptionStatus,
  SubscriptionStatus
> = {
  [PaddleSubscriptionStatus.Active]: SubscriptionStatus.Active,
  [PaddleSubscriptionStatus.Cancelled]: SubscriptionStatus.Cancelled,
  [PaddleSubscriptionStatus.PastDue]: SubscriptionStatus.PastDue,
  [PaddleSubscriptionStatus.Paused]: SubscriptionStatus.Paused,
};

export class PaddleWebhooksService {
  private readonly paddleWebhookSecret?: string;

  constructor(private readonly deps: PaddleWebhooksServiceDeps) {
    this.paddleWebhookSecret = deps.config.BACKEND_API_PADDLE_WEBHOOK_SECRET;
  }

  async isVerifiedWebhookEvent({
    signature,
    requestBody,
  }: {
    signature?: string;
    requestBody: string;
  }): Promise<boolean> {
    if (!signature) {
      return false;
    }

    if (!this.paddleWebhookSecret) {
      throw new Error(
        "Missing webhook secret in config while verifying paddle webhook event",
      );
    }

    const [timestampStr, eventSignatureStr] = signature.split(";");

    if (!timestampStr || !eventSignatureStr) {
      return false;
    }

    const timestamp = timestampStr.split("=")[1];

    if (!timestamp) {
      return false;
    }

    const eventSignature = eventSignatureStr.split("=")[1];

    if (!eventSignature) {
      return false;
    }

    const signedPayload = `${timestamp}:${requestBody}`;

    const expected = createHmac("sha256", this.paddleWebhookSecret)
      .update(signedPayload)
      .digest("hex");

    return expected === eventSignature;
  }

  async handleSubscriptionUpdatedEvent(
    event: PaddleEventSubscriptionUpdated | PaddleEventSubscriptionActivated,
  ): Promise<void> {
    if (event.data.status === PaddleSubscriptionStatus.Cancelled) {
      // subscription updated event also gets emitted alongside canceled event
      // no need to handle again
      return;
    }

    const subscriptionItemsWithProduct = await Promise.all(
      event.data.items.map(async (i) => {
        const paddleProductId = i.price.product_id;
        const product =
          await this.deps.paddleService.getProduct(paddleProductId);

        return {
          item: i,
          product,
        };
      }),
    );

    if (subscriptionItemsWithProduct.some((p) => !p.product.id)) {
      throw new Error(
        `Could not find product key for product ids ${subscriptionItemsWithProduct
          .map((p) => p.item.price.product_id)
          .join(", ")} when updating subscription`,
      );
    }

    const topLevelBenefits = subscriptionItemsWithProduct.find(
      (p) => BENEFITS_BY_TIER[p.product.id as SubscriptionProductKey],
    );

    const topLevelBenefitsProductKey = topLevelBenefits?.product.id;

    if (!topLevelBenefits || !topLevelBenefitsProductKey) {
      throw new Error(
        `Could not find benefits in BENEFITS_BY_TIER when updating subscription. Keys: ${subscriptionItemsWithProduct
          .map((p) => p.product.id)
          .join(", ")}`,
      );
    }

    const { email: billingEmail } = await this.deps.paddleService.getCustomer(
      event.data.customer_id,
    );

    const extraFeedsToAdd = subscriptionItemsWithProduct.find(
      (p) => p.product.id === SubscriptionProductKey.Tier3AdditionalFeed,
    )?.item.quantity;

    const benefits = BENEFITS_BY_TIER[topLevelBenefitsProductKey];

    if (!benefits) {
      throw new Error(
        `Could not find benefits for product key ${topLevelBenefitsProductKey} when updating subscription`,
      );
    }

    const useBenefits: TierBenefits = {
      ...benefits,
      maxUserFeeds: benefits.maxUserFeeds + (extraFeedsToAdd || 0),
    };

    const paddleCustomer = {
      customerId: event.data.customer_id,
      email: billingEmail,
      lastCurrencyCodeUsed: event.data.currency_code,
      subscription: {
        productKey: topLevelBenefitsProductKey as SubscriptionProductKey,
        status: this.convertPaddleStatusToSubscriptionStatus(event.data.status),
        id: event.data.id,
        createdAt: new Date(event.data.created_at),
        updatedAt: new Date(event.data.updated_at),
        benefits: useBenefits,
        addons: extraFeedsToAdd
          ? [
              {
                key: SubscriptionProductKey.Tier3AdditionalFeed,
                quantity: extraFeedsToAdd,
              },
            ]
          : [],
        cancellationDate:
          event.data.scheduled_change?.action === "cancel"
            ? new Date(event.data.current_billing_period.ends_at)
            : null,
        nextBillDate: event.data.next_billed_at
          ? new Date(event.data.next_billed_at)
          : null,
        billingPeriodStart: new Date(
          event.data.current_billing_period.starts_at,
        ),
        billingPeriodEnd: new Date(event.data.current_billing_period.ends_at),
        billingInterval: event.data.billing_cycle.interval,
        currencyCode: event.data.currency_code,
      },
      createdAt: new Date(event.data.created_at),
      updatedAt: new Date(event.data.updated_at),
    };

    // Checkout custom data carrying a workspace id marks the subscription as
    // belonging to that workspace, not to any member's personal supporter
    // record.
    const workspaceId = event.data.custom_data?.workspaceId;

    if (workspaceId) {
      // Tier 1 / Free are personal-only plans; recording one on a workspace
      // would grant the wrong benefits. Our checkout/update surfaces never
      // produce this, so fail loudly (Paddle retries, the error is logged).
      if (!WORKSPACE_BASE_TIER_KEYS.has(topLevelBenefitsProductKey)) {
        throw new Error(
          `Subscription product ${topLevelBenefitsProductKey} is not valid for workspace ${workspaceId}`,
        );
      }

      const workspace = await this.deps.workspaceRepository.upsertPaddleCustomer(
        workspaceId,
        paddleCustomer,
      );

      if (!workspace) {
        // The workspace may have been deleted while the event was in flight
        // (deletion schedules the Paddle cancellation for period end, so
        // events keep arriving until then). Retrying can never succeed, and a
        // workspace-routed event must never fall through to the personal
        // supporter path, so acknowledge it.
        logger.warn(
          `Ignoring subscription event for missing workspace ${workspaceId} (customer ${event.data.customer_id})`,
        );

        return;
      }

      // A subscription id belongs to either a workspace or a personal
      // supporter record, never both. When a personal subscription is
      // converted to a workspace, its custom_data is re-pointed and Paddle
      // re-emits this event with the workspace id; the same subscription is
      // still on the personal supporter record, so drop it there. (No-op for
      // the common case where the workspace subscribed directly.)
      const formerSupporter =
        await this.deps.supporterRepository.nullifySubscriptionBySubscriptionId(
          event.data.id,
        );

      // Every subscription transition (activation, tier change, quantity
      // change) funnels into the single workspace enforcement entry point.
      await this.enforceWorkspaceFeedLimits(workspaceId);

      // The former personal owner drops to the free allowance; enforce so any
      // feeds they left behind are disabled.
      if (formerSupporter?.id) {
        await this.enforceFeedLimits(formerSupporter.id);
      }

      return;
    }

    let discordUserId: string | undefined;

    if (event.data.custom_data?.userId) {
      const foundUser = await this.deps.userRepository.findById(
        event.data.custom_data.userId,
      );

      discordUserId = foundUser?.discordUserId;
    }

    if (!discordUserId) {
      const foundUser =
        await this.deps.userRepository.findByEmail(billingEmail);

      discordUserId = foundUser?.discordUserId;
    }

    if (!discordUserId) {
      throw new Error(
        `Could not resolve discord user ID when updating subscription for customer ${event.data.customer_id}`,
      );
    }

    await this.deps.supporterRepository.upsertPaddleCustomer(
      discordUserId,
      paddleCustomer,
    );

    await this.enforceFeedLimits(discordUserId);

    try {
      await this.deps.supportersService.syncDiscordSupporterRoles(
        discordUserId,
      );
    } catch (err) {
      logger.info(
        "Error while syncing discord supporter roles after handling subscription updated event",
        {
          stack: (err as Error).stack,
          supporterId: discordUserId,
        },
      );
    }
  }

  async handleSubscriptionCancelledEvent(
    event: PaddleEventSubscriptionCanceled,
  ): Promise<void> {
    const {
      data: { id: subscriptionId },
    } = event;

    // A subscription id belongs to either a workspace or a personal supporter
    // record, never both; the workspace lookup routes the lapse to dormancy
    // enforcement (feeds disabled, nothing deleted).
    const workspace =
      await this.deps.workspaceRepository.nullifySubscriptionBySubscriptionId(
        subscriptionId,
      );

    if (workspace) {
      await this.enforceWorkspaceFeedLimits(workspace.id);

      return;
    }

    const supporter =
      await this.deps.supporterRepository.nullifySubscriptionBySubscriptionId(
        subscriptionId,
      );

    if (supporter?.id) {
      await this.enforceFeedLimits(supporter.id);

      try {
        await this.deps.supportersService.syncDiscordSupporterRoles(
          supporter.id,
        );
      } catch (err) {
        logger.info(
          "Error while syncing discord supporter roles after handling subscription canceled event",
          {
            stack: (err as Error).stack,
            supporterId: supporter.id,
          },
        );
      }
    }
  }

  private convertPaddleStatusToSubscriptionStatus(
    status: PaddleSubscriptionStatus,
  ): SubscriptionStatus {
    const mapped = SUBSCRIPTION_STATUS_MAPPING[status];

    if (!mapped) {
      throw new Error(
        `Could not find subscription status for ${status} from paddle event`,
      );
    }

    return mapped;
  }

  private async enforceFeedLimits(discordUserId: string): Promise<void> {
    try {
      await this.deps.userFeedsService.enforceUserFeedLimit(discordUserId);
    } catch (err) {
      logger.error(
        `Error while enforcing feed limit after paddle webhook event`,
        {
          stack: (err as Error).stack,
        },
      );
    }
  }

  private async enforceWorkspaceFeedLimits(workspaceId: string): Promise<void> {
    try {
      await this.deps.userFeedsService.enforceWorkspaceFeedLimit(workspaceId);
    } catch (err) {
      logger.error(
        `Error while enforcing workspace feed limit after paddle webhook event`,
        {
          workspaceId,
          stack: (err as Error).stack,
        },
      );
    }
  }
}
