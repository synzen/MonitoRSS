import { randomUUID } from "crypto";
import dayjs from "dayjs";
import type { Config } from "../../config";
import type {
  IUserRepository,
  IUser,
} from "../../repositories/interfaces/user.types";
import type { IUserFeedRepository } from "../../repositories/interfaces/user-feed.types";
import type { ISupporterRepository } from "../../repositories/interfaces/supporter.types";
import type { SupportersService } from "../supporters/supporters.service";
import type { PaddleService } from "../paddle/paddle.service";
import {
  SubscriptionStatus,
  SubscriptionProductKey,
  UserExternalCredentialType,
} from "../../repositories/shared/enums";
import { formatCurrency } from "../../utils/format-currency";
import { encrypt } from "../../utils/encrypt";
import logger from "../../infra/logger";
import type {
  GetUserByDiscordIdOutput,
  UpdateUserPreferencesInput,
  SetRedditCredentialsInput,
} from "./types";

function getPrettySubscriptionNameFromKey(key: string): string {
  if (key === "free") return "Free";
  if (key === "tier1") return "Tier 1";
  if (key === "tier2") return "Tier 2";
  if (key === "tier3") return "Tier 3";
  return key;
}

export interface UsersServiceDeps {
  config: Config;
  userRepository: IUserRepository;
  userFeedRepository: IUserFeedRepository;
  supporterRepository: ISupporterRepository;
  supportersService: SupportersService;
  paddleService: PaddleService;
}

export class UsersService {
  private encryptionKeyHex?: string;
  private enableSupporters: boolean;

  constructor(private readonly deps: UsersServiceDeps) {
    this.encryptionKeyHex = deps.config.BACKEND_API_ENCRYPTION_KEY_HEX;
    this.enableSupporters = deps.config.BACKEND_API_ENABLE_SUPPORTERS;
  }

  async initDiscordUser(
    discordUserId: string,
    data?: { email?: string },
  ): Promise<IUser> {
    const found = await this.deps.userRepository.findByDiscordId(discordUserId);

    if (!found) {
      return this.deps.userRepository.create({
        discordUserId,
        email: data?.email,
      });
    }

    if (data?.email && (!found.email || found.email !== data.email)) {
      const updated = await this.deps.userRepository.updateEmailByDiscordId(
        discordUserId,
        data.email,
      );

      if (found.email !== data.email) {
        const supporter =
          await this.deps.supporterRepository.findById(discordUserId);

        if (supporter?.paddleCustomer?.customerId) {
          try {
            await this.deps.paddleService.updateCustomer(
              supporter.paddleCustomer.customerId,
              { email: data.email },
            );
          } catch (e) {
            logger.error(
              "Failed to update paddle customer email after email change",
              { error: (e as Error).stack },
            );
          }
        }
      }

      return updated!;
    }

    return found;
  }

  async getOrCreateUserByDiscordId(discordUserId: string): Promise<IUser> {
    const user = await this.deps.userRepository.findByDiscordId(discordUserId);

    if (!user) {
      return this.initDiscordUser(discordUserId);
    }

    return user;
  }

  async getIdByDiscordId(discordUserId: string): Promise<string | null> {
    return this.deps.userRepository.findIdByDiscordId(discordUserId);
  }

  async getByDiscordId(
    discordUserId: string,
  ): Promise<GetUserByDiscordIdOutput | null> {
    const user = await this.getOrCreateUserByDiscordId(discordUserId);

    const freeSubscription = {
      product: {
        key: SubscriptionProductKey.Free,
        name: "Free",
      },
      addons: [],
      status: SubscriptionStatus.Active,
      updatedAt: new Date(2020, 1, 1),
    };

    const externalAccounts =
      user.externalCredentials?.map((c) => ({
        type: c.type as "reddit",
        status: c.status,
      })) || [];

    const { maxPatreonPledge, allowExternalProperties } =
      await this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId);

    const isOnPatreon = !!maxPatreonPledge;

    if (!user.email) {
      return {
        user: {
          ...user,
          enableBilling: this.enableSupporters,
        },
        creditBalance: {
          availableFormatted: "0",
        },
        subscription: freeSubscription,
        supporterFeatures: {
          exrternalProperties: {
            enabled: allowExternalProperties,
          },
        },
        externalAccounts,
      };
    }

    const { subscription, customer } =
      await this.deps.supportersService.getSupporterSubscription({
        discordUserId: user.discordUserId,
      });

    let creditAvailableBalanceFormatted = "0";

    if (customer) {
      const { data: creditBalances } =
        await this.deps.paddleService.getCustomerCreditBalanace(customer.id);

      const creditBalanceInCurrency = creditBalances.find(
        (d: { currency_code: string }) =>
          d.currency_code === customer.currencyCode,
      );

      creditAvailableBalanceFormatted = formatCurrency(
        creditBalanceInCurrency?.balance.available || "0",
        customer.currencyCode,
      );
    }

    if (!subscription || subscription.status === SubscriptionStatus.Cancelled) {
      return {
        user: {
          ...user,
          enableBilling: this.enableSupporters,
        },
        creditBalance: {
          availableFormatted: creditAvailableBalanceFormatted,
        },
        externalAccounts,
        subscription: freeSubscription,
        isOnPatreon,
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
        enableBilling: this.enableSupporters,
      },
      creditBalance: {
        availableFormatted: creditAvailableBalanceFormatted,
      },
      externalAccounts,
      subscription: {
        product: {
          key: subscription.product.key,
          name: getPrettySubscriptionNameFromKey(subscription.product.key),
        },
        addons: subscription.addons || [],
        status: subscription.status,
        cancellationDate: subscription.cancellationDate,
        nextBillDate: subscription.nextBillDate,
        billingInterval: subscription.billingInterval,
        billingPeriod: {
          start: subscription.billingPeriod.start,
          end: subscription.billingPeriod.end,
        },
        updatedAt: subscription.updatedAt,
        pastDueGracePeriodEndDate: subscription.pastDueGracePeriodEndDate,
      },
      isOnPatreon,
      supporterFeatures: {
        exrternalProperties: {
          enabled: allowExternalProperties,
        },
      },
    };
  }

  async getEmailsForAlerts(discordUserIds: string[]): Promise<string[]> {
    return this.deps.userRepository.findEmailsByDiscordIdsWithAlertPreference(
      discordUserIds,
    );
  }

  async updateUserByDiscordId(
    discordUserId: string,
    data: { preferences?: UpdateUserPreferencesInput },
  ): Promise<GetUserByDiscordIdOutput | null> {
    if (!data.preferences || Object.keys(data.preferences).length === 0) {
      return this.getByDiscordId(discordUserId);
    }

    await this.getOrCreateUserByDiscordId(discordUserId);

    await this.deps.userRepository.updatePreferencesByDiscordId(
      discordUserId,
      data.preferences,
    );

    return this.getByDiscordId(discordUserId);
  }

  async setRedditCredentials(input: SetRedditCredentialsInput): Promise<void> {
    if (!this.encryptionKeyHex) {
      throw new Error("Encryption key not set while encrypting object values");
    }

    const expireAt = dayjs().add(input.expiresIn, "second").toDate();

    const encryptedData = this.encryptObjectValues({
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
    });

    await this.deps.userRepository.setExternalCredential(input.userId, {
      type: UserExternalCredentialType.Reddit,
      data: encryptedData,
      expireAt,
    });
  }

  async getRedditCredentials(userId: string) {
    return this.deps.userRepository.getExternalCredentials(
      userId,
      UserExternalCredentialType.Reddit,
    );
  }

  async removeRedditCredentials(userId: string): Promise<void> {
    await this.deps.userRepository.removeExternalCredentials(
      userId,
      UserExternalCredentialType.Reddit,
    );
  }

  async revokeRedditCredentials(
    userId: string,
    credentialId: string,
  ): Promise<void> {
    await this.deps.userRepository.revokeExternalCredential(
      userId,
      credentialId,
    );
  }

  async syncLookupKeys(data?: {
    feedIds?: string[];
    userIds?: string[];
  }): Promise<void> {
    const bulkWriteOps: Array<{
      feedId: string;
      action: "set" | "unset";
      lookupKey?: string;
    }> = [];

    for await (const {
      feedId,
      lookupKey,
    } of this.deps.userRepository.aggregateUsersWithActiveRedditCredentials({
      userIds: data?.userIds,
      feedIds: data?.feedIds,
    })) {
      if (lookupKey) {
        logger.debug(`Feed ${feedId} already has a lookup key, skipping`);
        continue;
      }

      logger.debug(`Updating lookup key for feed ${feedId}`);
      const newLookupKey = randomUUID();
      bulkWriteOps.push({
        feedId,
        action: "set",
        lookupKey: newLookupKey,
      });
    }

    for await (const {
      feedId,
    } of this.deps.userRepository.aggregateUsersWithExpiredOrRevokedRedditCredentials(
      { userIds: data?.userIds, feedIds: data?.feedIds },
    )) {
      logger.info(`Removing lookup key for feed ${feedId}`);
      bulkWriteOps.push({
        feedId,
        action: "unset",
      });
    }

    if (bulkWriteOps.length) {
      await this.deps.userFeedRepository.bulkUpdateLookupKeys(bulkWriteOps);
    }
  }

  private encryptObjectValues(
    input: Record<string, string>,
  ): Record<string, string> {
    if (!this.encryptionKeyHex) {
      throw new Error("Encryption key not set while encrypting object values");
    }

    return Object.entries(input).reduce(
      (acc, [key, value]) => {
        acc[key] = encrypt(value, this.encryptionKeyHex!);
        return acc;
      },
      {} as Record<string, string>,
    );
  }
}
