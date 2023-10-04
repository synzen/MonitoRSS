import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  Supporter,
  SupporterModel,
} from "../supporters/entities/supporter.entity";
import { SubscriptionProductKey } from "./constants/subscription-product-key.constants";
import { SupporterSubscriptionsService } from "./supporter-subscriptions.service";
import {
  PaddleEventSubscriptionActivated,
  PaddleEventSubscriptionUpdated,
} from "./types/paddle-webhook-events.type";
import { User, UserModel } from "../users/entities/user.entity";
import { SubscriptionStatus } from "../../common/constants/subscription-status.constants";
import { PaddleSubscriptionStatus } from "./constants/paddle-subscription-status.constants";

const BENEFITS_BY_TIER: Partial<
  Record<
    SubscriptionProductKey,
    Exclude<Supporter["paddleCustomer"], undefined>["benefits"]
  >
> = {
  [SubscriptionProductKey.Tier1]: {
    allowWebhooks: true,
    dailyArticleLimit: 200,
    maxUserFeeds: 15,
    refreshRateSeconds: 600,
  },
  [SubscriptionProductKey.Tier2]: {
    allowWebhooks: true,
    dailyArticleLimit: 500,
    maxUserFeeds: 40,
    refreshRateSeconds: 120,
  },
  [SubscriptionProductKey.Tier3]: {
    allowWebhooks: true,
    dailyArticleLimit: 1000,
    maxUserFeeds: 100,
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
  constructor(
    private readonly supporterSubscriptionsService: SupporterSubscriptionsService,
    @InjectModel(Supporter.name)
    private readonly supporterModel: SupporterModel,
    @InjectModel(User.name)
    private readonly userModel: UserModel
  ) {}

  async handleSubscriptionUpdatedEvent(
    event: PaddleEventSubscriptionUpdated | PaddleEventSubscriptionActivated
  ) {
    const { id: productKey } =
      await this.supporterSubscriptionsService.getProduct(
        event.data.items[0].price.product_id
      );

    const benefitsOfKey =
      BENEFITS_BY_TIER[productKey as SubscriptionProductKey];

    if (!benefitsOfKey) {
      throw new Error(
        `Could not find benefits for product key ${productKey} in BENEFITS_BY_TIER when updating subscription`
      );
    }

    const { email } = await this.supporterSubscriptionsService.getCustomer(
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
      productKey,
      status: this.convertPaddleStatusToSubscriptionStatus({
        status: event.data.status,
      }),
      email,
      subscriptionId: event.data.id,
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
      billingPeriodStart: new Date(event.data.current_billing_period.starts_at),
      billingPeriodEnd: new Date(event.data.current_billing_period.ends_at),
      billingInterval: event.data.billing_cycle.interval,
    };
    console.log(
      "🚀 ~ file: paddle-webhooks.service.ts:113 ~ PaddleWebhooksService ~ handleSubscriptionUpdatedEvent ~ toSet:",
      foundUser,
      toSet
    );

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
}
