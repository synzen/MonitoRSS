/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { UpdateQuery } from "mongoose";
import { SubscriptionStatus } from "../../common/constants/subscription-status.constants";
import { CreditBalanceDetails } from "../../common/types/credit-balance-details.type";
import { SubscriptionDetails } from "../../common/types/subscription-details.type";
import { formatCurrency } from "../../utils/format-currency";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import { PaddleService } from "../paddle/paddle.service";
import { SubscriptionProductKey } from "../supporter-subscriptions/constants/subscription-product-key.constants";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import {
  User,
  UserDocument,
  UserModel,
  UserPreferences,
} from "./entities/user.entity";

function getPrettySubscriptioNameFromKey(key: string) {
  if (key === "free") {
    return "Free";
  }

  if (key === "tier1") {
    return "Tier 1";
  }

  if (key === "tier2") {
    return "Tier 2";
  }

  if (key === "tier3") {
    return "Tier 3";
  }

  return key;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: UserModel,
    private readonly supportersService: SupportersService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
    private readonly paddleService: PaddleService
  ) {}

  async initDiscordUser(
    discordUserId: string,
    data?: {
      email?: string;
    }
  ) {
    const found = await this.userModel
      .findOne({ discordUserId })
      .select("_id email")
      .lean();

    if (!found) {
      return await this.userModel.create({
        discordUserId,
        email: data?.email,
      });
    } else if (!found.email && data?.email) {
      return (await this.userModel.findOneAndUpdate(
        {
          _id: found._id,
        },
        {
          $set: {
            email: data.email,
          },
        }
      )) as User;
    } else {
      return found;
    }
  }

  async getOrCreateUserByDiscordId(discordUserId: string): Promise<User> {
    const user = await this.userModel.findOne({ discordUserId }).lean();

    if (!user) {
      return this.initDiscordUser(discordUserId);
    }

    return user;
  }

  async getByDiscordId(discordUserId: string): Promise<{
    user: User;
    creditBalance: CreditBalanceDetails;
    subscription: SubscriptionDetails;
    isOnPatreon?: boolean;
    migratedToPersonalFeeds: boolean;
  } | null> {
    const user = await this.getOrCreateUserByDiscordId(discordUserId);

    const freeSubscription: SubscriptionDetails = {
      product: {
        key: SubscriptionProductKey.Free,
        name: "Free",
      },
      status: SubscriptionStatus.Active,
      updatedAt: new Date(2020, 1, 1), // doesn't matter here
    };

    const [legacyPatreonDetails, userFeed] = await Promise.all([
      this.supportersService.getLegacyPatreonDetails(discordUserId),
      this.userFeedModel
        .findOne({ "user.discordUserId": discordUserId })
        .select("_id")
        .lean(),
    ]);

    const isOnPatreon = !!legacyPatreonDetails.maxPatreonPledge;
    const migratedToPersonalFeeds = !!userFeed;

    if (!user.email) {
      return {
        user: {
          ...user,
          enableBilling: !!this.supportersService.enableSupporters,
        },
        creditBalance: {
          availableFormatted: "0",
        },
        subscription: freeSubscription,
        migratedToPersonalFeeds,
      };
    }

    const { subscription, customer } =
      await this.supportersService.getSupporterSubscription({
        email: user.email,
      });

    let creditAvailableBalanceFormatted = "0";

    if (customer) {
      const { data: creditBalances } =
        await this.paddleService.getCustomerCreditBalanace(customer.id);

      const creditBalanceInCurrency = creditBalances.find(
        (d) => d.currency_code === customer.currencyCode
      );

      creditAvailableBalanceFormatted = formatCurrency(
        creditBalanceInCurrency?.balance.available || "0",
        customer.currencyCode
      );
    }

    if (!subscription || subscription.status === SubscriptionStatus.Cancelled) {
      return {
        user: {
          ...user,
          enableBilling: !!this.supportersService.enableSupporters,
        },
        creditBalance: {
          availableFormatted: creditAvailableBalanceFormatted,
        },
        subscription: freeSubscription,
        isOnPatreon,
        migratedToPersonalFeeds,
      };
    }

    return {
      user: {
        ...user,
        enableBilling: !!this.supportersService.enableSupporters,
      },
      creditBalance: {
        availableFormatted: creditAvailableBalanceFormatted,
      },
      subscription: {
        product: {
          key: subscription.product.key,
          name: getPrettySubscriptioNameFromKey(subscription.product.key),
        },
        status: subscription.status,
        cancellationDate: subscription.cancellationDate,
        nextBillDate: subscription.nextBillDate,
        billingInterval: subscription.billingInterval,
        billingPeriod: {
          start: subscription.billingPeriod.start,
          end: subscription.billingPeriod.end,
        },
        updatedAt: subscription.updatedAt,
      },
      isOnPatreon,
      migratedToPersonalFeeds,
    };
  }

  async getEmailsForAlerts(discordUserIds: string[]): Promise<string[]> {
    const users = await this.userModel
      .find({
        discordUserId: {
          $in: discordUserIds,
        },
        email: {
          $exists: true,
        },
        "preferences.alertOnDisabledFeeds": true,
      })
      .distinct("email");

    return users;
  }

  async updateUserByDiscordId(discordUserId: string, data: Partial<User>) {
    const updateQuery: UpdateQuery<UserDocument> = {
      $set: {},
    };

    const hasPreferencesUpdate = Object.keys(data.preferences || {}).length > 0;

    if (hasPreferencesUpdate) {
      for (const key in data.preferences) {
        updateQuery.$set![`preferences.${key}`] =
          data.preferences[key as keyof UserPreferences];
      }
    }

    const user = await this.userModel.findOneAndUpdate(
      {
        discordUserId,
      },
      updateQuery,
      {
        new: true,
      }
    );

    if (!user) {
      return null;
    }

    return this.getByDiscordId(discordUserId);
  }
}
