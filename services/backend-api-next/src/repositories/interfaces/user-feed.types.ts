import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../shared/enums";
import type { IFeedConnections } from "./feed-connection.types";

// UserFeedUser
export interface IUserFeedUser {
  id?: string;
  discordUserId: string;
}

// UserFeedFormatOptions
export interface IUserFeedFormatOptions {
  dateFormat?: string;
  dateTimezone?: string;
  dateLocale?: string;
}

// UserFeedDateCheckOptions
export interface IUserFeedDateCheckOptions {
  oldArticleDateDiffMsThreshold?: number;
}

// ExternalFeedProperty
export interface IExternalFeedProperty {
  id: string;
  sourceField: string;
  cssSelector: string;
  label: string;
}

// UserFeedShareInviteConnection
export interface IUserFeedShareInviteConnection {
  connectionId: string;
}

// UserFeedUserShareManageUser
export interface IUserFeedUserShareManageUser {
  id: string;
  type: UserFeedManagerInviteType;
  discordUserId: string;
  status: UserFeedManagerStatus;
  connections?: IUserFeedShareInviteConnection[];
  createdAt: Date;
  updatedAt: Date;
}

// UserFeedShareManageOptions
export interface IUserFeedShareManageOptions {
  invites: IUserFeedUserShareManageUser[];
}

// UserFeed
export interface IUserFeed {
  id: string;
  title: string;
  inputUrl?: string;
  url: string;
  disabledCode?: UserFeedDisabledCode;
  passingComparisons?: string[];
  blockingComparisons?: string[];
  externalProperties?: IExternalFeedProperty[];
  healthStatus: UserFeedHealthStatus;
  connections: IFeedConnections;
  user: IUserFeedUser;
  formatOptions?: IUserFeedFormatOptions;
  dateCheckOptions?: IUserFeedDateCheckOptions;
  shareManageOptions?: IUserFeedShareManageOptions;
  legacyFeedId?: string;
  refreshRateSeconds?: number;
  maxDailyArticles?: number;
  userRefreshRateSeconds?: number;
  slotOffsetMs?: number;
  debug?: boolean;
  feedRequestLookupKey?: string;
  lastManualRequestAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LookupKeyOperation {
  feedId: string;
  action: "set" | "unset";
  lookupKey?: string;
}

export interface UserFeedForNotification {
  id: string;
  title: string;
  url: string;
  user: IUserFeedUser;
  shareManageOptions?: IUserFeedShareManageOptions;
}

export interface AddConnectionToInviteOperation {
  feedId: string;
  discordUserId: string;
  connectionId: string;
}

export interface RemoveConnectionsFromInvitesInput {
  feedId: string;
  connectionIds: string[];
}

export interface UserFeedForSlotOffsetMigration {
  id: string;
  url: string;
  effectiveRefreshRateSeconds: number;
}

export interface SlotOffsetUpdateOperation {
  feedId: string;
  slotOffsetMs: number;
}

export interface UserFeedForUserIdMigration {
  id: string;
  userDiscordUserId: string;
}

export interface UserIdUpdateOperation {
  feedId: string;
  userId: string;
}

export type CustomPlaceholderStepTransform = (
  step: Record<string, unknown>,
) => Record<string, unknown>;

export interface CreateUserFeedInput {
  title: string;
  url: string;
  user: { id: string; discordUserId: string };
  inputUrl?: string;
  connections?: IFeedConnections;
  feedRequestLookupKey?: string;
  createdAt?: Date;
  refreshRateSeconds?: number;
  slotOffsetMs?: number;
  maxDailyArticles?: number;
  dateCheckOptions?: IUserFeedDateCheckOptions;
  shareManageOptions?: {
    invites: Array<{
      discordUserId: string;
      status?: UserFeedManagerStatus;
      connections?: Array<{ connectionId: string }>;
    }>;
  };
  passingComparisons?: string[];
  blockingComparisons?: string[];
  externalProperties?: IExternalFeedProperty[];
  formatOptions?: IUserFeedFormatOptions;
  userRefreshRateSeconds?: number;
}

export type WebhookEnforcementTarget =
  | { type: "all-users"; supporterDiscordUserIds: string[] }
  | { type: "single-user"; discordUserId: string; allowWebhooks: boolean };

export type RefreshRateEnforcementTarget =
  | {
      type: "all-users";
      supporterLimits: Array<{
        discordUserId: string;
        refreshRateSeconds: number;
      }>;
    }
  | {
      type: "single-user";
      discordUserId: string;
      refreshRateSeconds: number;
    };

export enum UserFeedComputedStatus {
  Ok = "ok",
  RequiresAttention = "requires-attention",
  ManuallyDisabled = "manually-disabled",
  Retrying = "retrying",
}

export interface UserFeedListingFilters {
  disabledCodes?: (UserFeedDisabledCode | null)[];
  connectionDisabledCodes?: (string | null)[];
  computedStatuses?: UserFeedComputedStatus[];
  ownedByUser?: boolean;
}

export interface UserFeedListingInput {
  discordUserId: string;
  limit?: number;
  offset?: number;
  search?: string;
  sort?: string;
  filters?: UserFeedListingFilters;
}

export interface UserFeedListItem {
  id: string;
  title: string;
  url: string;
  inputUrl?: string;
  healthStatus: string;
  disabledCode?: UserFeedDisabledCode;
  createdAt: Date;
  computedStatus: UserFeedComputedStatus;
  legacyFeedId?: string;
  ownedByUser: boolean;
  refreshRateSeconds?: number;
}

export interface UserFeedLimitEnforcementResult {
  discordUserId: string;
  disabledFeedIds: string[];
  enabledFeedIds: string[];
}

export type UserFeedLimitEnforcementQuery =
  | { type: "include"; discordUserIds: string[] }
  | { type: "exclude"; discordUserIds: string[] };

export interface CloneConnectionToFeedsInput {
  targetFeedIds?: string[];
  ownershipDiscordUserId?: string;
  search?: string;
  connectionData: Record<string, unknown>;
}

export interface CloneUserFeedInput {
  sourceFeed: IUserFeed;
  overrides: {
    title?: string;
    url: string;
    inputUrl?: string;
  };
}

export interface CloneConnectionToFeedsResult {
  feedIdToConnectionId: Array<{ feedId: string; connectionId: string }>;
}

export interface UserFeedWithConnections {
  id: string;
  connections: IFeedConnections;
}

export interface CopySettingsTarget {
  type: "selected" | "all";
  feedIds?: string[];
  search?: string;
  excludeFeedId: string;
  ownerDiscordUserId: string;
}

export type CopyableSettings = Partial<
  Pick<
    IUserFeed,
    | "passingComparisons"
    | "blockingComparisons"
    | "externalProperties"
    | "dateCheckOptions"
    | "formatOptions"
    | "connections"
  >
> & {
  userRefreshRateSeconds?: number | null;
};

export interface CopySettingsToFeedsInput {
  target: CopySettingsTarget;
  settings: CopyableSettings;
}

export interface IUserFeedRepository {
  create(input: CreateUserFeedInput): Promise<IUserFeed>;
  findById(id: string): Promise<IUserFeed | null>;
  deleteAll(): Promise<void>;
  bulkUpdateLookupKeys(operations: LookupKeyOperation[]): Promise<void>;
  findByIdsForNotification(ids: string[]): Promise<UserFeedForNotification[]>;
  bulkAddConnectionsToInvites(
    operations: AddConnectionToInviteOperation[],
  ): Promise<void>;
  removeConnectionsFromInvites(
    input: RemoveConnectionsFromInvitesInput,
  ): Promise<void>;

  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { new?: boolean },
  ): Promise<IUserFeed | null>;

  updateWithConnectionFilter(
    feedId: string,
    connectionId: string,
    update: Record<string, unknown>,
  ): Promise<IUserFeed | null>;

  countByWebhookId(webhookId: string): Promise<number>;

  findOneByWebhookId(webhookId: string): Promise<IUserFeed | null>;

  // Listing methods
  getUserFeedsListing(input: UserFeedListingInput): Promise<UserFeedListItem[]>;
  getUserFeedsCount(
    input: Omit<UserFeedListingInput, "limit" | "offset" | "sort">,
  ): Promise<number>;

  // CRUD methods for UserFeedsService
  countByOwnership(discordUserId: string): Promise<number>;
  countByOwnershipExcludingDisabled(
    discordUserId: string,
    excludeDisabledCodes: UserFeedDisabledCode[],
  ): Promise<number>;
  findByUrls(discordUserId: string, urls: string[]): Promise<{ url: string }[]>;
  findByIdAndOwnership(
    id: string,
    discordUserId: string,
  ): Promise<IUserFeed | null>;
  updateById(
    id: string,
    update: Record<string, unknown>,
  ): Promise<IUserFeed | null>;
  deleteById(id: string): Promise<IUserFeed | null>;
  deleteByIds(ids: string[]): Promise<number>;
  updateManyByFilter(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<number>;
  findByIds(ids: string[]): Promise<IUserFeed[]>;
  getFeedsGroupedByUserForLimitEnforcement(
    query: UserFeedLimitEnforcementQuery,
  ): AsyncIterable<UserFeedLimitEnforcementResult>;

  disableFeedsByIds(
    feedIds: string[],
    disabledCode: UserFeedDisabledCode,
  ): Promise<void>;
  enableFeedsByIds(feedIds: string[]): Promise<void>;
  enforceWebhookConnections(target: WebhookEnforcementTarget): Promise<void>;

  // Cloning
  clone(input: CloneUserFeedInput): Promise<IUserFeed>;
  cloneConnectionToFeeds(
    input: CloneConnectionToFeedsInput,
  ): Promise<CloneConnectionToFeedsResult>;
  findManyWithConnectionsByFilter(
    filter: Record<string, unknown>,
  ): Promise<UserFeedWithConnections[]>;
  enforceRefreshRates(
    target: RefreshRateEnforcementTarget,
    supporterRefreshRateSeconds: number,
  ): Promise<void>;

  // Copy settings
  copySettingsToFeeds(input: CopySettingsToFeedsInput): Promise<number>;
  findFeedsWithApplicationOwnedWebhooks(
    target: CopySettingsTarget,
  ): Promise<UserFeedWithConnections[]>;

  // Migration methods
  iterateFeedsMissingSlotOffset(): AsyncIterable<UserFeedForSlotOffsetMigration>;
  bulkUpdateSlotOffsets(operations: SlotOffsetUpdateOperation[]): Promise<void>;
  iterateFeedsMissingUserId(): AsyncIterable<UserFeedForUserIdMigration>;
  bulkUpdateUserIds(operations: UserIdUpdateOperation[]): Promise<void>;
  migrateCustomPlaceholderSteps(
    transform: CustomPlaceholderStepTransform,
  ): Promise<number>;
  convertStringUserIdsToObjectIds(): Promise<number>;
}
