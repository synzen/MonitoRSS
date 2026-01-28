// User-related enums
export enum UserExternalCredentialType {
  Reddit = "reddit",
}

export enum UserExternalCredentialStatus {
  Revoked = "REVOKED",
  Active = "ACTIVE",
}

// Subscription/billing enums
export enum SubscriptionStatus {
  Active = "ACTIVE",
  Cancelled = "CANCELLED",
  PastDue = "PAST_DUE",
  Paused = "PAUSED",
}

export enum SubscriptionProductKey {
  Free = "free",
  Tier1 = "tier1",
  Tier2 = "tier2",
  Tier3 = "tier3",
  Tier3AdditionalFeed = "t3feed",
}

export enum LegacySubscriptionProductKey {
  Tier1Legacy = "tier1-legacy",
  Tier2Legacy = "tier2-legacy",
  Tier3Legacy = "tier3-legacy",
  Tier4Legacy = "tier4-legacy",
  Tier5Legacy = "tier5-legacy",
  Tier6Legacy = "tier6-legacy",
}

// Feed connection enums
export enum FeedConnectionType {
  DiscordChannel = "DISCORD_CHANNEL",
  DiscordWebhook = "DISCORD_WEBHOOK",
}

export enum FeedConnectionDisabledCode {
  Manual = "MANUAL",
  BadFormat = "BAD_FORMAT",
  MissingPermissions = "MISSING_PERMISSIONS",
  Unknown = "UNKNOWN",
  MissingMedium = "MISSING_MEDIUM",
  NotPaidSubscriber = "NOT_PAID_SUBSCRIBER",
}

export enum FeedConnectionDiscordChannelType {
  Forum = "forum",
  Thread = "thread",
  NewThread = "new-thread",
  ForumThread = "forum-thread",
}

export enum FeedConnectionMentionType {
  User = "user",
  Role = "role",
}

export enum FeedConnectionDiscordWebhookType {
  Forum = "forum",
  Thread = "thread",
  ForumThread = "forum-thread",
}

export enum FeedConnectionDiscordComponentType {
  ActionRow = 1,
  Button = 2,
  Section = 9,
  TextDisplay = 10,
  Thumbnail = 11,
}

export enum FeedConnectionDiscordComponentButtonStyle {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Link = 5,
}

// Custom placeholder enums
export enum CustomPlaceholderStepType {
  UrlEncode = "URL_ENCODE",
  DateFormat = "DATE_FORMAT",
  Regex = "REGEX",
  Uppercase = "UPPERCASE",
  Lowercase = "LOWERCASE",
}

// User feed enums
export enum UserFeedDisabledCode {
  BadFormat = "BAD_FORMAT",
  FailedRequests = "FAILED_REQUESTS",
  Manual = "MANUAL",
  InvalidFeed = "INVALID_FEED",
  ExceededFeedLimit = "EXCEEDED_FEED_LIMIT",
  ExcessivelyActive = "EXCESSIVELY_ACTIVE",
  FeedTooLarge = "FEED_TOO_LARGE",
}

export enum UserFeedHealthStatus {
  Ok = "OK",
  Failed = "FAILED",
  Failing = "FAILING",
}

// User feed management enums
export enum UserFeedManagerInviteType {
  CoManage = "CO_MANAGE",
  Transfer = "TRANSFER",
}

export enum UserFeedManagerStatus {
  Pending = "PENDING",
  Accepted = "ACCEPTED",
  Declined = "DECLINED",
}

// Feed subscriber enums
export enum FeedSubscriberType {
  USER = "user",
  ROLE = "role",
}

// Patron enums
export enum PatronStatus {
  ACTIVE = "active_patron",
  FORMER = "former_patron",
  DECLINED = "declined_patron",
}

// Notification enums
export enum NotificationDeliveryAttemptStatus {
  Pending = "pending",
  Success = "success",
  Failure = "failure",
}

export enum NotificationDeliveryAttemptType {
  DisabledFeed = "DISABLED_FEED",
  DisabledConnection = "DISABLED_CONNECTION",
}

// Supporter enums
export enum SupporterSource {
  Paddle = "paddle",
  Patron = "patron",
  Manual = "manual",
}
