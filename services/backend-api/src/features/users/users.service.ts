/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { UpdateQuery } from "mongoose";
import { SubscriptionStatus } from "../../common/constants/subscription-status.constants";
import { SubscriptionDetails } from "../../common/types/subscription-details.type";
import { SubscriptionProductKey } from "../supporter-subscriptions/constants/subscription-product-key.constants";
import { SupportersService } from "../supporters/supporters.service";
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
    private readonly supportersService: SupportersService
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
      await this.userModel.create({
        discordUserId,
        email: data?.email,
      });
    } else if (!found.email && data?.email) {
      await this.userModel.updateOne(
        {
          _id: found._id,
        },
        {
          $set: {
            email: data.email,
          },
        }
      );
    }
  }

  async getByDiscordId(discordUserId: string): Promise<{
    user: User;
    subscription: SubscriptionDetails;
  } | null> {
    const user = await this.userModel.findOne({ discordUserId }).lean();

    if (!user) {
      return null;
    }

    const freeSubscription: SubscriptionDetails = {
      product: {
        key: SubscriptionProductKey.Free,
        name: "Free",
      },
      status: SubscriptionStatus.Active,
      updatedAt: new Date(2020, 1, 1), // doesn't matter here
    };

    if (!user.email) {
      return {
        user,
        subscription: freeSubscription,
      };
    }

    const { subscription } =
      await this.supportersService.getSupporterSubscription(user.email);

    if (!subscription || subscription.status === SubscriptionStatus.Cancelled) {
      return {
        user,
        subscription: freeSubscription,
      };
    }

    return {
      user,
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
