import type {
  SubscriptionStatus,
  SubscriptionProductKey,
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
}

export interface ISupporterRepository {}
