import type {
  IUser,
  IUserPreferences,
  IUserExternalCredential,
} from "../../repositories/interfaces/user.types";
import type {
  SubscriptionStatus,
  UserExternalCredentialStatus,
} from "../../repositories/shared/enums";

export interface CreditBalanceDetails {
  availableFormatted: string;
}

export interface SubscriptionProductDetails {
  key: string;
  name: string;
}

export interface SubscriptionAddon {
  key: string;
  quantity: number;
}

export interface SubscriptionDetails {
  product: SubscriptionProductDetails;
  addons: SubscriptionAddon[];
  status: SubscriptionStatus;
  cancellationDate?: Date | null;
  nextBillDate?: Date | null;
  billingInterval?: "month" | "year";
  billingPeriod?: {
    start: Date;
    end: Date;
  };
  updatedAt: Date;
  pastDueGracePeriodEndDate?: Date;
}

export interface SupporterFeatures {
  exrternalProperties: {
    enabled: boolean;
  };
}

export interface ExternalAccountInfo {
  type: "reddit";
  status: UserExternalCredentialStatus;
}

export interface GetUserByDiscordIdOutput {
  user: IUser & { enableBilling: boolean };
  creditBalance: CreditBalanceDetails;
  subscription: SubscriptionDetails;
  isOnPatreon?: boolean;
  supporterFeatures: SupporterFeatures;
  externalAccounts: ExternalAccountInfo[];
}

export interface UpdateUserPreferencesInput {
  alertOnDisabledFeeds?: boolean | null;
  dateFormat?: string | null;
  dateTimezone?: string | null;
  dateLocale?: string | null;
  feedListSort?: IUserPreferences["feedListSort"] | null;
  feedListColumnVisibility?:
    | IUserPreferences["feedListColumnVisibility"]
    | null;
  feedListColumnOrder?: IUserPreferences["feedListColumnOrder"] | null;
  feedListStatusFilters?: IUserPreferences["feedListStatusFilters"] | null;
}

export interface SetRedditCredentialsInput {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
