import type {
  UserExternalCredentialType,
  UserExternalCredentialStatus,
} from "../shared/enums";

export interface IUserFeedListSort {
  key: string;
  direction: "asc" | "desc";
}

export interface IUserFeedListColumnVisibility {
  computedStatus?: boolean;
  title?: boolean;
  url?: boolean;
  createdAt?: boolean;
  ownedByUser?: boolean;
  refreshRateSeconds?: boolean;
}

export interface IUserFeedListColumnOrder {
  columns: string[];
}

export interface IUserFeedListStatusFilters {
  statuses: string[];
}

export interface IUserPreferences {
  alertOnDisabledFeeds?: boolean;
  dateFormat?: string;
  dateTimezone?: string;
  dateLocale?: string;
  feedListSort?: IUserFeedListSort;
  feedListColumnVisibility?: IUserFeedListColumnVisibility;
  feedListColumnOrder?: IUserFeedListColumnOrder;
  feedListStatusFilters?: IUserFeedListStatusFilters;
}

export interface IUserFeatureFlags {
  externalProperties?: boolean;
}

export interface IUserExternalCredential {
  id: string;
  type: UserExternalCredentialType;
  status: UserExternalCredentialStatus;
  data: Record<string, string>;
  expireAt?: Date;
}

export interface IUser {
  id: string;
  discordUserId: string;
  email?: string;
  preferences?: IUserPreferences;
  featureFlags?: IUserFeatureFlags;
  enableBilling?: boolean;
  externalCredentials?: IUserExternalCredential[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserRepository {}
