import dayjs from "dayjs";
import type { Config } from "../../config";
import type { PatronsService } from "../patrons/patrons.service";
import type { GuildSubscriptionsService } from "../guild-subscriptions/guild-subscriptions.service";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type {
  ISupporterRepository,
  SupportPatronAggregateResult,
  SupporterGuildAggregateResult,
  IUserFeedLimitOverrideRepository,
  ISupporter,
} from "../../repositories/interfaces";
import {
  SubscriptionStatus,
  SubscriptionProductKey,
  SupporterSource,
} from "../../repositories/shared/enums";
import type {
  ArticleRateLimit,
  SupporterBenefits,
  ServerBenefits,
  BenefitsFromSupporter,
  SupporterSubscriptionResult,
  DiscordUserBenefits,
} from "./types";
import type { GuildSubscriptionFormatted } from "../guild-subscriptions/types";
import logger from "../../infra/logger";

export interface SupportersServiceDeps {
  config: Config;
  patronsService: PatronsService;
  guildSubscriptionsService: GuildSubscriptionsService;
  discordApiService: DiscordApiService;
  supporterRepository: ISupporterRepository;
  userFeedLimitOverrideRepository: IUserFeedLimitOverrideRepository;
}

export class SupportersService {
  readonly defaultMaxFeeds: number;
  readonly defaultRefreshRateSeconds: number;
  readonly defaultSupporterRefreshRateSeconds = 120;
  readonly defaultMaxUserFeeds: number;
  readonly defaultMaxSupporterUserFeeds: number;
  readonly maxDailyArticlesSupporter: number;
  readonly maxDailyArticlesDefault: number;
  readonly defaultRateLimits: ArticleRateLimit[];
  readonly supporterRateLimits: ArticleRateLimit[];
  readonly enableSupporters?: boolean;
  readonly supporterGuildId?: string;
  readonly supporterRoleId?: string;
  readonly supporterSubroleIds: string[];

  static PAST_DUE_GRACE_PERIOD_DAYS = 10;

  constructor(private readonly deps: SupportersServiceDeps) {
    const { config } = deps;
    this.defaultMaxFeeds = Number(config.BACKEND_API_DEFAULT_MAX_FEEDS);
    this.defaultRefreshRateSeconds =
      config.BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES * 60;
    this.defaultMaxUserFeeds = Number(config.BACKEND_API_DEFAULT_MAX_USER_FEEDS);
    this.defaultMaxSupporterUserFeeds = Number(
      config.BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS
    );
    this.maxDailyArticlesSupporter = Number(
      config.BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER
    );
    this.maxDailyArticlesDefault = Number(
      config.BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT
    );
    this.enableSupporters = Boolean(config.BACKEND_API_ENABLE_SUPPORTERS);

    this.supporterGuildId = config.BACKEND_API_SUPPORTER_GUILD_ID;
    this.supporterRoleId = config.BACKEND_API_SUPPORTER_ROLE_ID;
    this.supporterSubroleIds =
      config.BACKEND_API_SUPPORTER_SUBROLE_IDS?.split(",") || [];

    this.defaultRateLimits = [
      {
        max: this.maxDailyArticlesDefault,
        timeWindowSeconds: 86400,
      },
    ];

    this.supporterRateLimits = [
      {
        max: this.maxDailyArticlesSupporter,
        timeWindowSeconds: 86400,
      },
    ];
  }

  static calculateGracePeriodEndDate(billingPeriodStart: Date): Date {
    return dayjs(billingPeriodStart)
      .add(SupportersService.PAST_DUE_GRACE_PERIOD_DAYS, "day")
      .toDate();
  }

  async areSupportersEnabled(): Promise<boolean | undefined> {
    return this.enableSupporters;
  }

  isValidSupporter(
    supporter?: (SupportPatronAggregateResult | SupporterGuildAggregateResult) & {
      paddleCustomer?: ISupporter["paddleCustomer"];
    }
  ): boolean {
    if (!supporter) {
      return false;
    }

    const { expireAt, patrons, paddleCustomer } = supporter;

    if (paddleCustomer?.subscription?.status === SubscriptionStatus.Active) {
      return true;
    }

    if (paddleCustomer?.subscription?.status === SubscriptionStatus.PastDue) {
      const gracePeriodEndDate = SupportersService.calculateGracePeriodEndDate(
        paddleCustomer.subscription.billingPeriodStart
      );

      if (dayjs().isBefore(dayjs(gracePeriodEndDate))) {
        return true;
      }
    }

    if (expireAt) {
      return dayjs(expireAt).isAfter(dayjs());
    }

    if (patrons.length) {
      return patrons.some((patron) =>
        this.deps.patronsService.isValidPatron(patron)
      );
    }

    return false;
  }

  getBenefitsFromSupporter(
    supporter: SupportPatronAggregateResult | SupporterGuildAggregateResult
  ): BenefitsFromSupporter {
    if (!this.isValidSupporter(supporter)) {
      return {
        isSupporter: false,
        maxFeeds: this.defaultMaxFeeds,
        maxGuilds: 0,
        webhooks: false,
        refreshRateSeconds: this.defaultRefreshRateSeconds,
        maxUserFeeds: this.defaultMaxUserFeeds,
        maxUserFeedsComposition: {
          base: this.defaultMaxUserFeeds,
          legacy: 0,
        },
        allowCustomPlaceholders: false,
        dailyArticleLimit: this.maxDailyArticlesDefault,
        allowExternalProperties: false,
      };
    }

    let useAllowCustomPlaceholders = false;
    let useAllowExternalProperties = false;

    const {
      existsAndIsValid: patronExistsAndIsValid,
      maxFeeds: patronMaxFeeds,
      maxUserFeeds: patronMaxUserFeeds,
      maxGuilds: patronMaxGuilds,
      refreshRateSeconds: patronRefreshRateSeconds,
      allowCustomPlaceholders: patronAllowCustomPlaceholders,
      maxPatreonPledge,
    } = this.deps.patronsService.getMaxBenefitsFromPatrons(supporter.patrons);

    let refreshRateSeconds = this.defaultRefreshRateSeconds;
    let isFromPatrons =
      supporter.patron === true && supporter.patrons.length > 0;

    if (supporter.paddleCustomer?.subscription) {
      refreshRateSeconds =
        supporter.paddleCustomer.subscription.benefits.refreshRateSeconds;

      isFromPatrons = false;
    } else if (supporter.slowRate) {
      refreshRateSeconds = this.defaultRefreshRateSeconds;
    } else if (isFromPatrons) {
      if (patronExistsAndIsValid) {
        refreshRateSeconds =
          patronRefreshRateSeconds || this.defaultRefreshRateSeconds;
      }
    } else {
      refreshRateSeconds = this.defaultSupporterRefreshRateSeconds;
    }

    if (supporter.paddleCustomer?.subscription) {
      const ineligibleProductKeys = [
        SubscriptionProductKey.Free,
        SubscriptionProductKey.Tier1,
      ];

      useAllowCustomPlaceholders = true;

      if (
        !ineligibleProductKeys.includes(
          supporter.paddleCustomer.subscription.productKey
        )
      ) {
        useAllowExternalProperties = true;
      }
    } else if (isFromPatrons && patronExistsAndIsValid) {
      useAllowCustomPlaceholders = patronAllowCustomPlaceholders;
      useAllowExternalProperties = (maxPatreonPledge ?? 0) > 10000;
    }

    let baseMaxUserFeeds: number;

    if (supporter.paddleCustomer?.subscription) {
      baseMaxUserFeeds =
        supporter.paddleCustomer.subscription.benefits.maxUserFeeds;
    } else if (supporter.maxUserFeeds) {
      baseMaxUserFeeds = supporter.maxUserFeeds;
    } else {
      baseMaxUserFeeds = this.defaultMaxUserFeeds;
    }

    baseMaxUserFeeds = Math.max(baseMaxUserFeeds, patronMaxUserFeeds);

    const legacyFeedLimitAddon =
      supporter.userFeedLimitOverrides?.[0]?.additionalUserFeeds || 0;

    let dailyArticleLimit = this.maxDailyArticlesDefault;

    if (supporter.paddleCustomer?.subscription) {
      dailyArticleLimit =
        supporter.paddleCustomer.subscription.benefits.dailyArticleLimit;
    } else if (isFromPatrons) {
      if (patronExistsAndIsValid) {
        dailyArticleLimit = this.maxDailyArticlesSupporter;
      }
    }

    return {
      source: supporter.paddleCustomer?.subscription?.status
        ? SupporterSource.Paddle
        : patronExistsAndIsValid
        ? SupporterSource.Patron
        : SupporterSource.Manual,
      isSupporter: isFromPatrons ? patronExistsAndIsValid : true,
      maxFeeds: Math.max(
        supporter.maxFeeds ?? this.defaultMaxFeeds,
        patronMaxFeeds
      ),
      maxUserFeeds: baseMaxUserFeeds + legacyFeedLimitAddon,
      maxUserFeedsComposition: {
        base: baseMaxUserFeeds,
        legacy: legacyFeedLimitAddon,
      },
      maxGuilds: Math.max(supporter.maxGuilds ?? 1, patronMaxGuilds),
      refreshRateSeconds,
      webhooks:
        supporter.paddleCustomer?.subscription?.benefits.allowWebhooks ?? true,
      allowCustomPlaceholders:
        supporter.allowCustomPlaceholders || useAllowCustomPlaceholders,
      dailyArticleLimit,
      maxPatreonPledge,
      allowExternalProperties: useAllowExternalProperties,
    };
  }

  async serverCanUseWebhooks(serverId: string): Promise<boolean> {
    const benefits = await this.getBenefitsOfServers([serverId]);
    return benefits[0]?.webhooks || false;
  }

  async getBenefitsOfServers(serverIds: string[]): Promise<ServerBenefits[]> {
    const subscriptions =
      await this.deps.guildSubscriptionsService.getAllSubscriptions({
        filters: { serverIds },
      });

    const allSupportersWithGuild =
      await this.deps.supporterRepository.aggregateSupportersForGuilds(serverIds);

    const benefitsMappedByServerIds = new Map<string, BenefitsFromSupporter[]>();

    for (const supporter of allSupportersWithGuild) {
      const { guildId } = supporter;
      const benefits = this.getBenefitsFromSupporter(supporter);
      const benefitsSoFar = benefitsMappedByServerIds.get(guildId);

      if (!benefitsSoFar) {
        benefitsMappedByServerIds.set(guildId, [benefits]);
      } else {
        benefitsSoFar.push(benefits);
      }
    }

    return serverIds.map((serverId) => {
      const subscription = subscriptions.find(
        (sub) => sub.guildId === serverId
      );
      const serverBenefits = benefitsMappedByServerIds.get(serverId);

      return this.calculateBenefitsOfServer(serverId, {
        subscription,
        supporterBenefits: serverBenefits,
      });
    });
  }

  private calculateBenefitsOfServer(
    serverId: string,
    {
      subscription,
      supporterBenefits: serverBenefits,
    }: {
      subscription?: GuildSubscriptionFormatted;
      supporterBenefits?: BenefitsFromSupporter[];
    }
  ): ServerBenefits {
    if (subscription) {
      return {
        hasSupporter: true,
        maxFeeds: subscription.maxFeeds,
        refreshRateSeconds: subscription.refreshRate,
        serverId,
        webhooks: true,
      };
    }

    if (!serverBenefits?.length) {
      return {
        hasSupporter: false,
        maxFeeds: this.defaultMaxFeeds,
        serverId,
        webhooks: false,
      };
    }

    return {
      hasSupporter: serverBenefits.some((b) => b.isSupporter),
      maxFeeds: Math.max(...serverBenefits.map((b) => b.maxFeeds)),
      serverId,
      webhooks: serverBenefits.some((b) => b.webhooks),
      refreshRateSeconds: serverBenefits.find(
        (b) => b.refreshRateSeconds !== undefined
      )?.refreshRateSeconds,
    };
  }

  async getBenefitsOfDiscordUser(discordId: string): Promise<SupporterBenefits> {
    if (!this.enableSupporters) {
      return {
        isSupporter: true,
        maxFeeds: this.defaultMaxFeeds,
        guilds: [],
        maxGuilds: 0,
        refreshRateSeconds: this.defaultRefreshRateSeconds,
        maxDailyArticles: this.maxDailyArticlesDefault,
        maxUserFeeds: this.defaultMaxUserFeeds,
        maxUserFeedsComposition: {
          base: this.defaultMaxUserFeeds,
          legacy: 0,
        },
        allowCustomPlaceholders: true,
        articleRateLimits: this.defaultRateLimits,
        subscription: undefined,
        allowExternalProperties: true,
      };
    }

    const aggregate =
      await this.deps.supporterRepository.aggregateWithPatronsAndOverrides(discordId);

    const found = await this.deps.userFeedLimitOverrideRepository.findById(discordId);

    const base = this.defaultMaxUserFeeds;
    const legacyAdd = found?.additionalUserFeeds || 0;

    if (!aggregate.length) {
      return {
        isSupporter: false,
        maxFeeds: this.defaultMaxFeeds,
        guilds: [],
        maxGuilds: 0,
        refreshRateSeconds: this.defaultRefreshRateSeconds,
        maxDailyArticles: this.maxDailyArticlesDefault,
        maxUserFeeds: base + legacyAdd,
        maxUserFeedsComposition: {
          base: base,
          legacy: legacyAdd,
        },
        allowCustomPlaceholders: false,
        articleRateLimits: this.defaultRateLimits,
        subscription: undefined,
        allowExternalProperties: false,
      };
    }

    const benefits = this.getBenefitsFromSupporter(aggregate[0]!);

    return {
      isSupporter: benefits.isSupporter,
      source: benefits.source,
      maxFeeds: benefits.maxFeeds,
      guilds: aggregate[0]!.guilds,
      maxGuilds: benefits.maxGuilds,
      expireAt: aggregate[0]!.expireAt,
      refreshRateSeconds: benefits.refreshRateSeconds,
      maxDailyArticles: benefits.isSupporter
        ? this.maxDailyArticlesSupporter
        : this.maxDailyArticlesDefault,
      maxUserFeeds: benefits.maxUserFeeds,
      maxUserFeedsComposition: benefits.maxUserFeedsComposition,
      allowCustomPlaceholders: benefits.allowCustomPlaceholders,
      articleRateLimits: benefits.isSupporter
        ? this.supporterRateLimits
        : this.defaultRateLimits,
      subscription:
        benefits.source === SupporterSource.Paddle &&
        aggregate[0]!.paddleCustomer?.subscription
          ? {
              productKey: aggregate[0]!.paddleCustomer.subscription.productKey,
              status: aggregate[0]!.paddleCustomer.subscription.status,
            }
          : undefined,
      maxPatreonPledge: benefits.maxPatreonPledge,
      allowExternalProperties: benefits.allowExternalProperties,
    };
  }

  async setGuilds(
    userId: string,
    guildIds: string[]
  ): Promise<ISupporter | null> {
    if (!this.deps.supporterRepository) {
      throw new Error("Supporter repository not available");
    }

    const updatedSupporter = await this.deps.supporterRepository.updateGuilds(
      userId,
      guildIds
    );

    if (!updatedSupporter) {
      throw new Error(
        `User ${userId} was not found while updating supporter guild ids`
      );
    }

    return updatedSupporter;
  }

  async getSupporterSubscription({
    billingEmail,
    discordUserId,
  }:
    | { billingEmail: string; discordUserId?: string }
    | { billingEmail?: string; discordUserId: string }): Promise<SupporterSubscriptionResult> {
    let supporter: ISupporter | null = null;

    if (billingEmail) {
      supporter = await this.deps.supporterRepository.findByPaddleEmail(billingEmail);
    } else if (discordUserId) {
      supporter = await this.deps.supporterRepository.findById(discordUserId);
    }

    if (!supporter?.paddleCustomer) {
      return {
        discordUserId: supporter?.id,
        customer: null,
        subscription: null,
      };
    }

    if (!supporter.paddleCustomer.subscription) {
      return {
        discordUserId: supporter.id,
        customer: {
          id: supporter.paddleCustomer.customerId,
          currencyCode: supporter.paddleCustomer.lastCurrencyCodeUsed,
        },
        subscription: null,
      };
    }

    const subscription = supporter.paddleCustomer.subscription;

    const pastDueGracePeriodEndDate =
      subscription.status === SubscriptionStatus.PastDue
        ? SupportersService.calculateGracePeriodEndDate(
            subscription.billingPeriodStart
          )
        : undefined;

    return {
      discordUserId: supporter.id,
      customer: {
        id: supporter.paddleCustomer.customerId,
        currencyCode: supporter.paddleCustomer.lastCurrencyCodeUsed,
      },
      subscription: {
        id: subscription.id,
        product: {
          key: subscription.productKey,
        },
        currencyCode: subscription.currencyCode,
        status: subscription.status,
        nextBillDate: subscription.nextBillDate,
        cancellationDate: subscription.cancellationDate,
        billingInterval: subscription.billingInterval,
        billingPeriod: {
          start: subscription.billingPeriodStart,
          end: subscription.billingPeriodEnd,
        },
        updatedAt: subscription.updatedAt,
        addons: subscription.addons,
        pastDueGracePeriodEndDate,
      },
    };
  }

  async syncDiscordSupporterRoles(discordUserId: string): Promise<void> {
    const { supporterGuildId, supporterRoleId, supporterSubroleIds } = this;

    if (
      !supporterGuildId ||
      !supporterRoleId ||
      !supporterSubroleIds.length
    ) {
      return;
    }

    const { subscription } = await this.getSupporterSubscription({
      discordUserId,
    });

    const member = await this.deps.discordApiService.getGuildMember(
      supporterGuildId,
      discordUserId
    );

    if (!subscription) {
      const allRelevantRoles = [supporterRoleId, ...supporterSubroleIds];

      await Promise.all(
        allRelevantRoles.map(async (roleId) => {
          if (!member.roles.includes(roleId)) {
            return;
          }

          try {
            await this.deps.discordApiService.removeGuildMemberRole({
              guildId: supporterGuildId,
              userId: discordUserId,
              roleId,
            });
          } catch (err) {
            logger.error(
              `Supporter roles: Failed to remove role ${roleId} from user ${discordUserId} in guild ${supporterGuildId}`,
              {
                stack: (err as Error).stack,
              }
            );
          }
        })
      );

      return;
    }

    if (!member.roles.includes(supporterRoleId)) {
      try {
        await this.deps.discordApiService.addGuildMemberRole({
          guildId: supporterGuildId,
          userId: discordUserId,
          roleId: supporterRoleId,
        });
      } catch (err) {
        logger.error(
          `Supporter roles: Failed to add role ${supporterRoleId} to user ${discordUserId} in guild ${supporterGuildId}`,
          {
            stack: (err as Error).stack,
          }
        );
      }
    }

    let useRoleId: string | undefined = undefined;

    if (subscription.product.key === SubscriptionProductKey.Tier1) {
      useRoleId = supporterSubroleIds[0];
    } else if (subscription.product.key === SubscriptionProductKey.Tier2) {
      useRoleId = supporterSubroleIds[1];
    } else if (subscription.product.key === SubscriptionProductKey.Tier3) {
      useRoleId = supporterSubroleIds[2];
    }

    const removeRoleIds = supporterSubroleIds.filter(
      (roleId) => roleId !== useRoleId
    );

    await Promise.all(
      removeRoleIds.map(async (roleId) => {
        if (!member.roles.includes(roleId)) {
          return;
        }

        try {
          await this.deps.discordApiService.removeGuildMemberRole({
            guildId: supporterGuildId,
            userId: discordUserId,
            roleId,
          });
        } catch (err) {
          logger.error(
            `Supporter roles: Failed to remove role ${roleId} from user ${discordUserId} in guild ${supporterGuildId}`,
            {
              stack: (err as Error).stack,
            }
          );
        }
      })
    );

    if (useRoleId && !member.roles.includes(useRoleId)) {
      try {
        await this.deps.discordApiService.addGuildMemberRole({
          guildId: supporterGuildId,
          userId: discordUserId,
          roleId: useRoleId,
        });
      } catch (err) {
        logger.error(
          `Supporter roles: Failed to add role ${useRoleId} to user ${discordUserId} in guild ${supporterGuildId}`,
          {
            stack: (err as Error).stack,
          }
        );
      }
    }
  }

  async getBenefitsOfAllDiscordUsers(): Promise<DiscordUserBenefits[]> {
    if (!this.enableSupporters) {
      return [];
    }

    const aggregate =
      await this.deps.supporterRepository.aggregateAllSupportersWithPatrons();

    const benefits = aggregate.map((agg) => this.getBenefitsFromSupporter(agg));
    const supporterIds = aggregate.map((agg) => agg.id);

    const nonSupporterOverrides =
      await this.deps.userFeedLimitOverrideRepository.findByIdsNotIn(supporterIds);

    const nonSupporterBenefits: DiscordUserBenefits[] = nonSupporterOverrides.map(
      (override) => ({
        discordUserId: override.id,
        refreshRateSeconds: this.defaultRefreshRateSeconds,
        isSupporter: false,
        maxDailyArticles: this.maxDailyArticlesDefault,
        maxUserFeeds:
          this.defaultMaxUserFeeds + (override.additionalUserFeeds || 0),
        maxPatreonPledge: 0,
      })
    );

    return benefits
      .map((b, i): DiscordUserBenefits => ({
        discordUserId: aggregate[i]!.id,
        refreshRateSeconds: b.refreshRateSeconds,
        isSupporter: b.isSupporter,
        maxDailyArticles: b.isSupporter
          ? this.maxDailyArticlesSupporter
          : this.maxDailyArticlesDefault,
        maxUserFeeds: b.maxUserFeeds,
        maxPatreonPledge: b.maxPatreonPledge || 0,
        source: b.source,
      }))
      .concat(nonSupporterBenefits);
  }

  async getBenefitsOfAllServers(): Promise<ServerBenefits[]> {
    const subscriptions =
      await this.deps.guildSubscriptionsService.getAllSubscriptions();

    if (subscriptions.length === 0) {
      return [];
    }

    const subscriptionsByGuildId = new Map(
      subscriptions.map((sub) => [sub.guildId, sub])
    );

    const allSupportersWithGuild =
      await this.deps.supporterRepository.aggregateAllSupportersWithGuilds();

    const benefitsMappedByServerIds = new Map<string, BenefitsFromSupporter[]>();

    for (const supporter of allSupportersWithGuild) {
      const { guildId } = supporter;
      const benefits = this.getBenefitsFromSupporter(supporter);
      const benefitsSoFar = benefitsMappedByServerIds.get(guildId);

      if (!benefitsSoFar) {
        benefitsMappedByServerIds.set(guildId, [benefits]);
      } else {
        benefitsSoFar.push(benefits);
      }
    }

    const serverIds = allSupportersWithGuild.map(
      (supporter) => supporter.guildId
    );

    return serverIds.map((serverId) => {
      const subscription = subscriptionsByGuildId.get(serverId);
      const serverBenefits = benefitsMappedByServerIds.get(serverId);

      return this.calculateBenefitsOfServer(serverId, {
        subscription,
        supporterBenefits: serverBenefits,
      });
    });
  }
}
