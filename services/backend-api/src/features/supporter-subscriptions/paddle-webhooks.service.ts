import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  Supporter,
  SupporterModel,
} from "../supporters/entities/supporter.entity";
import {
  LegacySubscriptionProductKey,
  SubscriptionProductKey,
} from "./constants/subscription-product-key.constants";
import {
  PaddleEventSubscriptionActivated,
  PaddleEventSubscriptionCanceled,
  PaddleEventSubscriptionUpdated,
} from "./types/paddle-webhook-events.type";
import { User, UserModel } from "../users/entities/user.entity";
import { SubscriptionStatus } from "../../common/constants/subscription-status.constants";
import { PaddleSubscriptionStatus } from "./constants/paddle-subscription-status.constants";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import { SupportersService } from "../supporters/supporters.service";
import logger from "../../utils/logger";
import { UserFeedsService } from "../user-feeds/user-feeds.service";
import { PaddleService } from "../paddle/paddle.service";
const BENEFITS_BY_TIER: Partial<
  Record<
    SubscriptionProductKey | LegacySubscriptionProductKey,
    Exclude<
      Exclude<Supporter["paddleCustomer"], undefined>["subscription"],
      undefined | null
    >["benefits"]
  >
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
    maxUserFeeds: 70,
    refreshRateSeconds: 120,
  },
  [SubscriptionProductKey.Tier3]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 140,
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

@Injectable()
export class PaddleWebhooksService {
  paddleWebhookSecret?: string;
  constructor(
    @InjectModel(Supporter.name)
    private readonly supporterModel: SupporterModel,
    @InjectModel(User.name)
    private readonly userModel: UserModel,
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    private readonly userFeedsService: UserFeedsService,
    private readonly paddleService: PaddleService
  ) {
    this.paddleWebhookSecret = this.configService.get<string>(
      "BACKEND_API_PADDLE_WEBHOOK_SECRET"
    );
  }

  async isVerifiedWebhookEvent({
    signature,
    requestBody,
  }: {
    signature?: string;
    requestBody: string;
  }) {
    if (!signature) {
      return false;
    }

    if (!this.paddleWebhookSecret) {
      throw new Error(
        "Missing webhook secret in config while verifying paddle webhook event"
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

    // generate hmac using sha256 with paddleWebhookSecret as secret key
    const expected = createHmac("sha256", this.paddleWebhookSecret)
      .update(signedPayload)
      .digest("hex");

    return expected === eventSignature;
  }

  async handleSubscriptionUpdatedEvent(
    event: PaddleEventSubscriptionUpdated | PaddleEventSubscriptionActivated
  ) {
    if (event.data.status === "canceled") {
      // subscription updated event also gets emitted alongside canceled event
      // no need to handle again
      return;
    }

    const { id: productKey } = await this.paddleService.getProduct(
      event.data.items[0].price.product_id
    );

    if (!productKey) {
      throw new Error(
        `Could not find product key for product id ${event.data.items[0].price.product_id} when updating subscription`
      );
    }

    const benefitsOfKey =
      BENEFITS_BY_TIER[productKey as SubscriptionProductKey];

    if (!benefitsOfKey) {
      throw new Error(
        `Could not find benefits for product key ${productKey} in BENEFITS_BY_TIER when updating subscription`
      );
    }

    const { email } = await this.paddleService.getCustomer(
      event.data.customer_id
    );

    const foundUser = await this.userModel
      .findOne({
        email,
      })
      .select("discordUserId")
      .lean();

    if (!foundUser) {
      throw new Error(
        `Could not find user with email ${email} when updating subscription for customer ${event.data.customer_id}`
      );
    }

    const toSet: Supporter["paddleCustomer"] = {
      customerId: event.data.customer_id,
      email,
      lastCurrencyCodeUsed: event.data.currency_code,
      subscription: {
        productKey,
        status: this.convertPaddleStatusToSubscriptionStatus({
          status: event.data.status,
        }),
        id: event.data.id,
        createdAt: new Date(event.data.created_at),
        updatedAt: new Date(event.data.updated_at),
        benefits: benefitsOfKey,
        cancellationDate:
          event.data.scheduled_change?.action === "cancel"
            ? new Date(event.data.current_billing_period.ends_at)
            : null,
        nextBillDate: event.data.next_billed_at
          ? new Date(event.data.next_billed_at)
          : null,
        billingPeriodStart: new Date(
          event.data.current_billing_period.starts_at
        ),
        billingPeriodEnd: new Date(event.data.current_billing_period.ends_at),
        billingInterval: event.data.billing_cycle.interval,
        currencyCode: event.data.currency_code,
      },
      createdAt: new Date(event.data.created_at),
      updatedAt: new Date(event.data.updated_at),
    };

    await this.supporterModel.findOneAndUpdate(
      {
        _id: foundUser.discordUserId,
      },
      {
        $set: {
          paddleCustomer: toSet,
        },
      },
      {
        upsert: true,
      }
    );

    // await this.enforceFeedLimit({
    //   discordUserId: foundUser.discordUserId,
    // });

    try {
      await this.supportersService.syncDiscordSupporterRoles(
        foundUser.discordUserId
      );
    } catch (err) {
      logger.info(
        "Error while syncing discord supporter roles after handling subscription updated event",
        {
          stack: (err as Error).stack,
          supporterId: foundUser.discordUserId,
        }
      );
    }
  }

  async handleSubscriptionCancelledEvent(
    event: PaddleEventSubscriptionCanceled
  ) {
    const {
      data: { id: subscriptionId },
    } = event;

    const supporter = await this.supporterModel.findOneAndUpdate(
      {
        "paddleCustomer.subscription.id": subscriptionId,
      },
      {
        $set: {
          "paddleCustomer.subscription": null,
        },
      }
    );

    if (supporter?._id) {
      // await this.enforceFeedLimit({
      //   discordUserId: supporter._id,
      // });

      try {
        await this.supportersService.syncDiscordSupporterRoles(supporter._id);
      } catch (err) {
        logger.info(
          "Error while syncing discord supporter roles after handling subscription canceled event",
          {
            stack: (err as Error).stack,
            supporterId: supporter._id,
          }
        );
      }
    }
  }

  private convertPaddleStatusToSubscriptionStatus({
    status,
  }: {
    status: PaddleSubscriptionStatus;
  }): SubscriptionStatus {
    const mapped = SUBSCRIPTION_STATUS_MAPPING[status];

    if (!mapped) {
      throw new Error(
        `Could not find subscription status for ${status} from paddle event`
      );
    }

    return mapped;
  }

  private async enforceFeedLimit({ discordUserId }: { discordUserId: string }) {
    try {
      const { maxUserFeeds, refreshRateSeconds } =
        await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

      await this.userFeedsService.enforceUserFeedLimits([
        {
          discordUserId,
          maxUserFeeds,
          refreshRateSeconds,
        },
      ]);
    } catch (err) {
      logger.error(
        `Error while enforcing feed limit for discord user ${discordUserId}`,
        {
          stack: (err as Error).stack,
        }
      );
    }
  }
}
