import {
  UserExternalCredentialType,
  FeedConnectionDisabledCode,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../shared/enums";
import type { IFeedConnections } from "./feed-connection.types";
import type { SlotWindow } from "../../shared/types/slot-window.types";

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
      type?: UserFeedManagerInviteType;
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
  Ok = "OK",
  RequiresAttention = "REQUIRES_ATTENTION",
  ManuallyDisabled = "MANUALLY_DISABLED",
  Retrying = "RETRYING",
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

export interface UserFeedForBulkOperation {
  id: string;
  discordUserId: string;
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

export interface AddInviteToFeedInput {
  discordUserId: string;
  type: UserFeedManagerInviteType;
  status: UserFeedManagerStatus;
  connections?: Array<{ connectionId: string }>;
}

export interface UpdateInviteRepoInput {
  status?: UserFeedManagerStatus;
  connections?: Array<{ connectionId: string }> | null;
}

export interface UserFeedForPendingInvites {
  id: string;
  title: string;
  url: string;
  user: { discordUserId: string };
  shareManageOptions: IUserFeedShareManageOptions;
}

export interface ScheduledFeedUrl {
  url: string;
}

export interface ScheduledFeedWithLookupKey {
  url: string;
  feedRequestLookupKey?: string;
  users: Array<{
    externalCredentials?: Array<{
      type: UserExternalCredentialType;
      data: Record<string, string>;
    }>;
  }>;
}

export interface FeedForSlotOffsetRecalculation {
  id: string;
  url: string;
  userRefreshRateSeconds?: number;
}

export interface RefreshRateSyncInput {
  supporterLimits: Array<{
    discordUserIds: string[];
    refreshRateSeconds: number;
  }>;
  defaultRefreshRateSeconds: number;
}

export interface MaxDailyArticlesSyncInput {
  supporterLimits: Array<{
    discordUserIds: string[];
    maxDailyArticles: number;
  }>;
  defaultMaxDailyArticles: number;
}

export interface UserForDelivery {
  externalCredentials?: Array<{
    type: string;
    data: Record<string, string>;
  }>;
  preferences?: {
    dateFormat?: string;
    dateTimezone?: string;
    dateLocale?: string;
  };
}

export interface UserFeedForDelivery {
  id: string;
  url: string;
  debug?: boolean;
  maxDailyArticles?: number;
  connections: IFeedConnections;
  passingComparisons?: string[];
  blockingComparisons?: string[];
  formatOptions?: IUserFeedFormatOptions;
  externalProperties?: IExternalFeedProperty[];
  dateCheckOptions?: IUserFeedDateCheckOptions;
  feedRequestLookupKey?: string;
  user: {
    discordUserId: string;
  };
  users: Array<UserForDelivery>;
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
  filterFeedIdsByOwnership(
    feedIds: string[],
    discordUserId: string,
  ): Promise<string[]>;

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
  findByIdAndCreator(
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
  areAllValidIds(ids: string[]): boolean;
  countByIds(ids: string[]): Promise<number>;
  findByIds(ids: string[]): Promise<IUserFeed[]>;
  findEligibleFeedsForDisable(
    feedIds: string[],
    eligibleDisabledCodes: UserFeedDisabledCode[],
  ): Promise<UserFeedForBulkOperation[]>;
  findEligibleFeedsForEnable(
    feedIds: string[],
  ): Promise<UserFeedForBulkOperation[]>;
  findDiscordUserIdsByFeedIds(feedIds: string[]): Promise<string[]>;
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

  // Invite management methods
  findByInviteIdAndOwner(
    inviteId: string,
    ownerDiscordUserId: string,
  ): Promise<IUserFeed | null>;
  findByInviteIdAndInvitee(
    inviteId: string,
    inviteeDiscordUserId: string,
  ): Promise<IUserFeed | null>;
  deleteInviteFromFeed(feedId: string, inviteId: string): Promise<void>;
  updateInviteStatus(
    feedId: string,
    inviteId: string,
    status: UserFeedManagerStatus,
  ): Promise<IUserFeed | null>;
  addInviteToFeed(feedId: string, invite: AddInviteToFeedInput): Promise<void>;
  updateInvite(
    feedId: string,
    inviteIndex: number,
    updates: UpdateInviteRepoInput,
  ): Promise<void>;
  transferFeedOwnership(
    feedId: string,
    newOwnerDiscordUserId: string,
  ): Promise<void>;
  findFeedsWithPendingInvitesForUser(
    discordUserId: string,
  ): Promise<UserFeedForPendingInvites[]>;
  countPendingInvitesForUser(discordUserId: string): Promise<number>;

  // Migration methods
  iterateFeedsMissingSlotOffset(): AsyncIterable<UserFeedForSlotOffsetMigration>;
  bulkUpdateSlotOffsets(operations: SlotOffsetUpdateOperation[]): Promise<void>;
  iterateFeedsMissingUserId(): AsyncIterable<UserFeedForUserIdMigration>;
  bulkUpdateUserIds(operations: UserIdUpdateOperation[]): Promise<void>;
  migrateCustomPlaceholderSteps(
    transform: CustomPlaceholderStepTransform,
  ): Promise<number>;
  convertStringUserIdsToObjectIds(): Promise<number>;

  // Schedule handler methods
  findDebugFeedUrls(): Promise<Set<string>>;
  syncRefreshRates(input: RefreshRateSyncInput): Promise<void>;
  syncMaxDailyArticles(input: MaxDailyArticlesSyncInput): Promise<void>;
  iterateFeedsForRefreshRateSync(
    input: RefreshRateSyncInput,
  ): AsyncIterable<
    FeedForSlotOffsetRecalculation & { newRefreshRateSeconds: number }
  >;
  iterateUrlsForRefreshRate(
    refreshRateSeconds: number,
    slotWindow: SlotWindow,
  ): AsyncIterable<{ url: string }>;
  iterateFeedsWithLookupKeysForRefreshRate(
    refreshRateSeconds: number,
    slotWindow: SlotWindow,
  ): AsyncIterable<ScheduledFeedWithLookupKey>;

  // Message broker events methods
  updateHealthStatusByFilter(
    filter: { url?: string; lookupKey?: string },
    healthStatus: UserFeedHealthStatus,
    excludeStatus?: UserFeedHealthStatus,
  ): Promise<number>;

  countWithHealthStatusFilter(
    filter: { url?: string; lookupKey?: string },
    excludeHealthStatus: UserFeedHealthStatus,
  ): Promise<number>;

  iterateFeedsForDelivery(params: {
    url: string;
    refreshRateSeconds: number;
    debug?: boolean;
  }): AsyncIterable<UserFeedForDelivery>;

  iterateFeedsWithLookupKeysForDelivery(params: {
    lookupKey: string;
    refreshRateSeconds: number;
    debug?: boolean;
  }): AsyncIterable<UserFeedForDelivery>;

  findIdsWithoutDisabledCode(filter: {
    url?: string;
    lookupKey?: string;
  }): Promise<string[]>;

  setConnectionDisabledCode(
    feedId: string,
    connectionKey: string,
    connectionIndex: number,
    disabledCode: FeedConnectionDisabledCode,
    disabledDetail?: string,
  ): Promise<void>;

  // Atomic disable + health status update for handleUrlRequestFailureEvent
  disableFeedsAndSetHealthStatus(
    feedIds: string[],
    disabledCode: UserFeedDisabledCode,
    healthStatus: UserFeedHealthStatus,
  ): Promise<void>;

  // Atomic disable for feeds without existing disabledCode
  disableFeedByIdIfNotDisabled(
    feedId: string,
    disabledCode: UserFeedDisabledCode,
  ): Promise<boolean>;

  // Atomic bulk disable for feeds without existing disabledCode
  disableFeedsByFilterIfNotDisabled(
    filter: { url?: string; lookupKey?: string },
    disabledCode: UserFeedDisabledCode,
  ): Promise<number>;
}
