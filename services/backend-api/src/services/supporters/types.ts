import type {
  SubscriptionStatus,
  SupporterSource,
} from "../../repositories/shared/enums";

export interface DiscordUserBenefits {
  discordUserId: string;
  refreshRateSeconds: number;
  isSupporter: boolean;
  maxDailyArticles: number;
  maxUserFeeds: number;
  maxPatreonPledge: number;
  source?: SupporterSource;
}

export interface ArticleRateLimit {
  max: number;
  timeWindowSeconds: number;
}

export interface SupporterBenefits {
  isSupporter: boolean;
  maxFeeds: number;
  guilds: string[];
  source?: SupporterSource;
  maxGuilds: number;
  expireAt?: Date;
  refreshRateSeconds: number;
  maxDailyArticles: number;
  maxUserFeeds: number;
  maxUserFeedsComposition: {
    base: number;
    legacy: number;
  };
  allowCustomPlaceholders: boolean;
  articleRateLimits: ArticleRateLimit[];
  subscription?: {
    productKey: string;
    status: SubscriptionStatus;
  };
  maxPatreonPledge?: number;
  allowExternalProperties: boolean;
}

export interface ServerBenefits {
  hasSupporter: boolean;
  maxFeeds: number;
  serverId: string;
  webhooks: boolean;
  refreshRateSeconds?: number;
}

export interface BenefitsFromSupporter {
  source?: SupporterSource;
  isSupporter: boolean;
  maxFeeds: number;
  maxUserFeeds: number;
  maxUserFeedsComposition: {
    base: number;
    legacy: number;
  };
  maxGuilds: number;
  refreshRateSeconds: number;
  webhooks: boolean;
  allowCustomPlaceholders: boolean;
  dailyArticleLimit: number;
  maxPatreonPledge?: number;
  allowExternalProperties: boolean;
}

export interface SupporterSubscriptionResult {
  discordUserId?: string;
  customer: {
    id: string;
    currencyCode: string;
  } | null;
  subscription: {
    id: string;
    product: {
      key: string;
    };
    currencyCode: string;
    status: SubscriptionStatus;
    nextBillDate?: Date | null;
    cancellationDate?: Date | null;
    billingInterval: "month" | "year";
    billingPeriod: {
      start: Date;
      end: Date;
    };
    updatedAt: Date;
    addons?: Array<{
      key: string;
      quantity: number;
    }>;
    pastDueGracePeriodEndDate?: Date;
  } | null;
}
