/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ObjectId, Types, UpdateQuery } from "mongoose";
import { SubscriptionStatus } from "../../common/constants/subscription-status.constants";
import { CreditBalanceDetails } from "../../common/types/credit-balance-details.type";
import { SubscriptionDetails } from "../../common/types/subscription-details.type";
import { formatCurrency } from "../../utils/format-currency";
import { PaddleService } from "../paddle/paddle.service";
import { SubscriptionProductKey } from "../supporter-subscriptions/constants/subscription-product-key.constants";
import { SupportersService } from "../supporters/supporters.service";
import {
  User,
  UserDocument,
  UserModel,
  UserPreferences,
} from "./entities/user.entity";
import {
  Supporter,
  SupporterModel,
} from "../supporters/entities/supporter.entity";
import logger from "../../utils/logger";
import { UserExternalCredentialType } from "../../common/constants/user-external-credential-type.constants";
import encrypt from "../../utils/encrypt";
import { ConfigService } from "@nestjs/config";
import dayjs from "dayjs";
import { UserExternalCredentialStatus } from "../../common/constants/user-external-credential-status.constants";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { randomUUID } from "crypto";
import { getRedditUrlRegex } from "../../utils/get-reddit-url-regex";

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

export interface GetUserByDiscordIdOutput {
  user: User;
  creditBalance: CreditBalanceDetails;
  subscription: SubscriptionDetails;
  isOnPatreon?: boolean;
  migratedToPersonalFeeds: boolean;
  supporterFeatures: {
    exrternalProperties: {
      enabled: boolean;
    };
  };
  externalAccounts: Array<{ type: "reddit" }>;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: UserModel,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly supportersService: SupportersService,
    @InjectModel(Supporter.name)
    private readonly supporterModel: SupporterModel,
    private readonly paddleService: PaddleService,
    private readonly configService: ConfigService
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
    } else if (data?.email && (!found.email || found.email !== data.email)) {
      const updated = (await this.userModel.findOneAndUpdate(
        {
          _id: found._id,
        },
        {
          $set: {
            email: data.email,
          },
        }
      )) as User;

      if (found.email !== data.email) {
        const supporter = await this.supporterModel
          .findOne({
            _id: found.discordUserId,
          })
          .select("paddleCustomer")
          .lean();

        if (!supporter || !supporter.paddleCustomer) {
          return updated;
        }

        const {
          paddleCustomer: { customerId },
        } = supporter;

        await this.paddleService
          .updateCustomer(customerId, {
            email: data.email,
          })
          .catch((e) => {
            logger.error(
              "Failed to update paddle customer email after email change",
              e
            );
          });
      }

      return updated;
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

  async getIdByDiscordId(discordUserId: string): Promise<ObjectId | null> {
    const user = await this.userModel
      .findOne({ discordUserId })
      .select("_id")
      .lean();

    return user?._id || null;
  }

  async getByDiscordId(
    discordUserId: string
  ): Promise<GetUserByDiscordIdOutput | null> {
    const user = await this.getOrCreateUserByDiscordId(discordUserId);

    const freeSubscription: SubscriptionDetails = {
      product: {
        key: SubscriptionProductKey.Free,
        name: "Free",
      },
      status: SubscriptionStatus.Active,
      updatedAt: new Date(2020, 1, 1), // doesn't matter here
    };

    const externalAccounts: GetUserByDiscordIdOutput["externalAccounts"] = [];

    if (
      user.externalCredentials?.find(
        (c) => c.type === UserExternalCredentialType.Reddit
      )
    ) {
      externalAccounts.push({ type: "reddit" });
    }

    const { maxPatreonPledge, allowExternalProperties } =
      await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

    const isOnPatreon = !!maxPatreonPledge;

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
        migratedToPersonalFeeds: true,
        supporterFeatures: {
          exrternalProperties: {
            enabled: allowExternalProperties,
          },
        },
        externalAccounts,
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
        externalAccounts,
        subscription: freeSubscription,
        isOnPatreon,
        migratedToPersonalFeeds: true,
        supporterFeatures: {
          exrternalProperties: {
            enabled: allowExternalProperties,
          },
        },
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
      externalAccounts,
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
      migratedToPersonalFeeds: true,
      supporterFeatures: {
        exrternalProperties: {
          enabled: allowExternalProperties,
        },
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

  async setRedditCredentials({
    userId,
    accessToken,
    expiresIn,
    refreshToken,
  }: {
    userId: Types.ObjectId;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }) {
    const useExpireAt = dayjs().add(expiresIn, "second").toDate();

    const ecryptedData = this.encryptObjectValues({
      accessToken,
      refreshToken,
    });

    const setQueries = Object.entries(ecryptedData).reduce(
      (acc, [key, value]) => {
        acc[`externalCredentials.$.data.${key}`] = value;

        return acc;
      },
      {} as Record<string, string>
    );
    const finalSetQuery = {
      ...setQueries,
      "externalCredentials.$.expireAt": useExpireAt,
    };

    const result = await this.userModel.updateOne(
      {
        _id: userId,
        externalCredentials: {
          $elemMatch: {
            type: UserExternalCredentialType.Reddit,
          },
        },
      },
      {
        $set: finalSetQuery,
      }
    );

    if (!result.modifiedCount) {
      await this.userModel.updateOne(
        {
          _id: userId,
        },
        {
          $push: {
            externalCredentials: {
              type: UserExternalCredentialType.Reddit,
              data: ecryptedData,
              expireAt: useExpireAt,
            },
          },
        }
      );
    }
  }

  async getRedditCredentials(userId: Types.ObjectId) {
    const user = await this.userModel
      .findOne(
        { _id: userId },
        {
          externalCredentials: 1,
        }
      )
      .lean();

    if (!user) {
      return null;
    }

    const redditCredentials = user.externalCredentials?.find(
      (c) => c.type === UserExternalCredentialType.Reddit
    );

    return redditCredentials;
  }

  async removeRedditCredentials(userId: Types.ObjectId) {
    await this.userModel.updateOne(
      {
        _id: userId,
      },
      {
        $pull: {
          externalCredentials: {
            type: UserExternalCredentialType.Reddit,
          },
        },
      }
    );
  }

  async revokeRedditCredentials(
    userId: Types.ObjectId,
    credentialId: Types.ObjectId
  ) {
    await this.userModel.updateOne(
      {
        _id: userId,
        "externalCredentials._id": credentialId,
      },
      {
        $set: {
          "externalCredentials.$.status": UserExternalCredentialStatus.Revoked,
        },
      }
    );
  }

  async syncLookupKeys(data?: {
    feedIds?: Types.ObjectId[];
    userIds?: Types.ObjectId[];
  }) {
    // Add lookup keys as necessary
    const feedIdsToUpdate = this.userModel
      .aggregate([
        {
          $match: {
            ...(data?.userIds?.length
              ? {
                  _id: {
                    $in: data.userIds,
                  },
                }
              : {}),
            externalCredentials: {
              $elemMatch: {
                expireAt: {
                  $gt: new Date(),
                },
                status: UserExternalCredentialStatus.Active,
                type: UserExternalCredentialType.Reddit,
              },
            },
          },
        },
        {
          $lookup: {
            from: "userfeeds",
            localField: "discordUserId",
            foreignField: "user.discordUserId",
            as: "feeds",
          },
        },
        {
          $unwind: {
            path: "$feeds",
          },
        },
        {
          $match: {
            "feeds.url": getRedditUrlRegex(),
            ...(data?.feedIds?.length
              ? {
                  "feeds._id": {
                    $in: data.feedIds,
                  },
                }
              : {}),
          },
        },
        {
          $project: {
            feedId: "$feeds._id",
            lookupKey: "$feeds.feedRequestLookupKey",
            _id: 0,
          },
        },
      ])
      .cursor();

    const validLookupKeys: string[] = [];

    for await (const { feedId, lookupKey } of feedIdsToUpdate) {
      if (lookupKey) {
        validLookupKeys.push(lookupKey);
        logger.debug(`Feed ${feedId} already has a lookup key, skipping`);
        continue;
      }

      logger.debug(`Updating lookup key for feed ${feedId}`);
      const newLookupKey = randomUUID();
      await this.userFeedModel.updateOne(
        {
          _id: feedId,
        },
        {
          $set: {
            feedRequestLookupKey: newLookupKey,
          },
        }
      );

      validLookupKeys.push(newLookupKey);
    }

    // Remove lookup keys as necessary
    const feedIdsToRemove = this.userModel.aggregate([
      {
        $match: {
          ...(data?.userIds?.length
            ? {
                _id: {
                  $in: data.userIds,
                },
              }
            : {}),
          $or: [
            {
              externalCredentials: {
                $elemMatch: {
                  type: UserExternalCredentialType.Reddit,
                  expireAt: {
                    $lte: new Date(),
                  },
                },
              },
            },
            {
              externalCredentials: {
                $elemMatch: {
                  type: UserExternalCredentialType.Reddit,
                  status: UserExternalCredentialStatus.Revoked,
                },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "userfeeds",
          localField: "discordUserId",
          foreignField: "user.discordUserId",
          as: "feeds",
        },
      },
      {
        $unwind: {
          path: "$feeds",
        },
      },
      {
        $match: {
          "feeds.url": getRedditUrlRegex(),
          ...(data?.feedIds?.length
            ? {
                "feeds._id": {
                  $in: data.feedIds,
                },
              }
            : {}),
        },
      },
      {
        $project: {
          feedId: "$feeds._id",
          _id: 0,
        },
      },
    ]);

    for await (const { feedId } of feedIdsToRemove) {
      logger.info(`Removing lookup key for feed ${feedId}`);
      await this.userFeedModel.updateOne(
        {
          _id: feedId,
        },
        {
          $unset: {
            feedRequestLookupKey: "",
          },
        }
      );
    }
  }

  private encryptObjectValues(input: Record<string, string>) {
    const encryptionHexKey = this.configService.get(
      "BACKEND_API_ENCRYPTION_KEY_HEX"
    );

    if (!encryptionHexKey) {
      throw new Error("Encryption key not set while encrypting object values");
    }

    return Object.entries(input).reduce((acc, [key, value]) => {
      acc[key] = encrypt(value, encryptionHexKey);

      return acc;
    }, {} as Record<string, string>);
  }
}
