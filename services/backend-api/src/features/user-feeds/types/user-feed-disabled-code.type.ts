export enum UserFeedDisabledCode {
  BadFormat = "BAD_FORMAT",
  FailedRequests = "FAILED_REQUESTS",
  Manual = "MANUAL",
  InvalidFeed = "INVALID_FEED",
  ExceededFeedLimit = "EXCEEDED_FEED_LIMIT",
  ExcessivelyActive = "EXCESSIVELY_ACTIVE",
  FeedTooLarge = "FEED_TOO_LARGE",
}

export const DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS = [
  UserFeedDisabledCode.ExceededFeedLimit,
  UserFeedDisabledCode.Manual,
];
