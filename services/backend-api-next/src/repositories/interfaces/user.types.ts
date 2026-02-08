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

export interface CreateUserInput {
  discordUserId: string;
  email?: string;
}

export interface UpdateUserPreferencesInput {
  alertOnDisabledFeeds?: boolean | null;
  dateFormat?: string | null;
  dateTimezone?: string | null;
  dateLocale?: string | null;
  feedListSort?: IUserFeedListSort | null;
  feedListColumnVisibility?: IUserFeedListColumnVisibility | null;
  feedListColumnOrder?: IUserFeedListColumnOrder | null;
  feedListStatusFilters?: IUserFeedListStatusFilters | null;
}

export interface SetExternalCredentialInput {
  type: UserExternalCredentialType;
  data: Record<string, string>;
  expireAt?: Date;
}

export interface IUserRepository {
  findById(id: string): Promise<IUser | null>;
  findByDiscordId(discordUserId: string): Promise<IUser | null>;
  findIdByDiscordId(discordUserId: string): Promise<string | null>;
  create(input: CreateUserInput): Promise<IUser>;
  updateEmailByDiscordId(
    discordUserId: string,
    email: string,
  ): Promise<IUser | null>;
  updatePreferencesByDiscordId(
    discordUserId: string,
    preferences: UpdateUserPreferencesInput,
  ): Promise<IUser | null>;
  findEmailsByDiscordIdsWithAlertPreference(
    discordUserIds: string[],
  ): Promise<string[]>;
  setExternalCredential(
    userId: string,
    credential: SetExternalCredentialInput,
  ): Promise<void>;
  getExternalCredentials(
    userId: string,
    type: UserExternalCredentialType,
  ): Promise<IUserExternalCredential | null>;
  removeExternalCredentials(
    userId: string,
    type: UserExternalCredentialType,
  ): Promise<void>;
  revokeExternalCredential(userId: string, credentialId: string): Promise<void>;
  aggregateUsersWithActiveRedditCredentials(options?: {
    userIds?: string[];
    feedIds?: string[];
  }): AsyncIterable<{
    discordUserId: string;
    feedId: string;
    lookupKey?: string;
  }>;
  aggregateUsersWithExpiredOrRevokedRedditCredentials(options?: {
    userIds?: string[];
    feedIds?: string[];
  }): AsyncIterable<{ feedId: string }>;
  iterateUsersWithExpiringRedditCredentials(withinMs: number): AsyncIterable<{
    userId: string;
    discordUserId: string;
    credentialId: string;
    encryptedRefreshToken: string;
  }>;
}
