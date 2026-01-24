import type {
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

export interface IUserFeedRepository {}

// UserFeedTag
export interface IUserFeedTag {
  id: string;
  label: string;
  color?: string;
  feedIds: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserFeedTagRepository {}
