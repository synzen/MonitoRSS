import type {
  SubscriptionStatus,
  SubscriptionProductKey,
  PatronStatus,
} from "../shared/enums";

// Supporter entity
export interface IPaddleCustomerBenefits {
  maxUserFeeds: number;
  allowWebhooks: boolean;
  dailyArticleLimit: number;
  refreshRateSeconds: number;
}

export interface IPaddleCustomerSubscriptionAddon {
  key: SubscriptionProductKey;
  quantity: number;
}

export interface IPaddleCustomerSubscription {
  productKey: SubscriptionProductKey;
  id: string;
  status: SubscriptionStatus;
  currencyCode: string;
  cancellationDate?: Date | null;
  nextBillDate?: Date | null;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  billingInterval: "month" | "year";
  benefits: IPaddleCustomerBenefits;
  addons?: IPaddleCustomerSubscriptionAddon[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaddleCustomer {
  customerId: string;
  subscription?: IPaddleCustomerSubscription | null;
  lastCurrencyCodeUsed: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupporter {
  id: string;
  patron?: boolean;
  stripe?: boolean;
  webhook?: boolean;
  maxGuilds?: number;
  maxFeeds?: number;
  maxUserFeeds?: number;
  allowCustomPlaceholders?: boolean;
  guilds: string[];
  expireAt?: Date;
  paddleCustomer?: IPaddleCustomer;
  slowRate?: boolean;
}

export interface SupportPatronAggregateResult {
  id: string;
  patron?: boolean;
  maxFeeds?: number;
  maxUserFeeds?: number;
  maxGuilds?: number;
  slowRate?: boolean;
  allowCustomPlaceholders?: boolean;
  guilds: string[];
  expireAt?: Date;
  paddleCustomer?: IPaddleCustomer;
  patrons: Array<{
    id: string;
    status: PatronStatus;
    pledge: number;
    pledgeLifetime: number;
    pledgeOverride?: number;
    lastCharge?: Date;
  }>;
  userFeedLimitOverrides?: Array<{
    id: string;
    additionalUserFeeds: number;
  }>;
}

export interface SupporterGuildAggregateResult {
  id: string;
  patron?: boolean;
  maxFeeds?: number;
  maxUserFeeds?: number;
  maxGuilds?: number;
  slowRate?: boolean;
  allowCustomPlaceholders?: boolean;
  guildId: string;
  guilds?: string[];
  expireAt?: Date;
  paddleCustomer?: IPaddleCustomer;
  patrons: Array<{
    id: string;
    status: PatronStatus;
    pledge: number;
    pledgeLifetime: number;
    pledgeOverride?: number;
    lastCharge?: Date;
  }>;
  userFeedLimitOverrides?: Array<{
    id: string;
    additionalUserFeeds: number;
  }>;
}

export interface ISupporterRepository {
  findById(id: string): Promise<ISupporter | null>;
  findByPaddleEmail(email: string): Promise<ISupporter | null>;
  create(supporter: ISupporter): Promise<ISupporter>;
  updateGuilds(userId: string, guildIds: string[]): Promise<ISupporter | null>;
  deleteAll(): Promise<void>;
  aggregateWithPatronsAndOverrides(
    discordId: string,
  ): Promise<SupportPatronAggregateResult[]>;
  aggregateSupportersForGuilds(
    guildIds: string[],
  ): Promise<SupporterGuildAggregateResult[]>;
  aggregateAllSupportersWithPatrons(): Promise<SupportPatronAggregateResult[]>;
  aggregateAllSupportersWithGuilds(): Promise<SupporterGuildAggregateResult[]>;
}
