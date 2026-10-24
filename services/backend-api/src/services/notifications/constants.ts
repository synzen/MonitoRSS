import {
  UserFeedDisabledCode,
  FeedConnectionDisabledCode,
} from "../../repositories/shared/enums";

export const USER_FEED_DISABLED_REASONS: Partial<
  Record<UserFeedDisabledCode, { reason: string; action: string }>
> = {
  [UserFeedDisabledCode.ExceededFeedLimit]: {
    reason: "Exceeded feed limit",
    action:
      "Remove some feeds or become a supporter to get an increased feed limit.",
  },
  [UserFeedDisabledCode.FailedRequests]: {
    reason: "Too many failed attempts to fetch feed",
    action:
      "Check that the feed is still valid by using online validators or by clicking the feed link." +
      " If it is valid, try re-enabling it in the control panel.",
  },
  [UserFeedDisabledCode.FeedTooLarge]: {
    reason: "Too large to be processed",
    action:
      "Consider an alternative feed with fewer articles. If you are the feed owner, consider reducing the number of items in the feed." +
      " If you believe this is a mistake, please contact support.",
  },
  [UserFeedDisabledCode.InvalidFeed]: {
    reason: "Not a valid RSS XML feed",
    action:
      "Check that the feed is still valid by using online validators or by clicking the feed link." +
      " If it is valid, try re-enabling it in the control panel.",
  },
};

export const USER_FEED_CONNECTION_DISABLED_REASONS: Partial<
  Record<FeedConnectionDisabledCode, { reason: string; action: string }>
> = {
  [FeedConnectionDisabledCode.BadFormat]: {
    reason: "Message could not be sent with the current message format",
    action:
      "Update your message customization settings and send test articles, especially for the latest articles on the feed, to confirm delivery works.",
  },
  [FeedConnectionDisabledCode.MissingMedium]: {
    reason: "The channel with the service provider is missing",
    action: "Re-target the feed connection to a working channel.",
  },
  [FeedConnectionDisabledCode.MissingPermissions]: {
    reason: "Service provider rejected message due to lack of permissions",
    action:
      "Ensure the bot has all required permissions to deliver articles to the service provider.",
  },
  [FeedConnectionDisabledCode.Unknown]: {
    reason: "Unknown error",
    action: "Contact support.",
  },
};
