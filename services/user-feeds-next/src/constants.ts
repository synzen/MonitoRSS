export enum CustomPlaceholderStepType {
  UrlEncode = "URL_ENCODE",
  DateFormat = "DATE_FORMAT",
  Regex = "REGEX",
  Uppercase = "UPPERCASE",
  Lowercase = "LOWERCASE",
}

export enum DiscordComponentType {
  // Legacy components (numeric for backwards compatibility)
  ActionRow = 1,
  Button = 2,

  // V2 components (string enums for easier debugging)
  Section = "SECTION",
  TextDisplay = "TEXT_DISPLAY",
  Thumbnail = "THUMBNAIL",
  ActionRowV2 = "ACTION_ROW",
  ButtonV2 = "BUTTON",
  SeparatorV2 = "SEPARATOR",
  ContainerV2 = "CONTAINER",
  MediaGalleryV2 = "MEDIA_GALLERY",
}

export enum MediumKey {
  Discord = "discord",
}

/**
 * Prefix for injected article content placeholders from external feed properties.
 */
export const INJECTED_ARTICLE_PLACEHOLDER_PREFIX = "external::";

/**
 * Maximum number of articles to process with external content injection.
 * This limit exists for performance reasons.
 */
export const MAX_ARTICLE_INJECTION_ARTICLE_COUNT = 50;

/**
 * Message broker queue names for RabbitMQ.
 */
export enum MessageBrokerQueue {
  FeedDeliverArticles = "feed.deliver-articles",
  FeedArticleDeliveryResult = "feed.article-delivery-result",
  FeedRejectedArticleDisableConnection = "feed.rejected-article.disable-connection",
  FeedDeleted = "feed.deleted",
  FeedRejectedDisableFeed = "feed.rejected.disable-feed",
}

/**
 * Codes indicating why a feed was disabled.
 */
export enum FeedRejectedDisabledCode {
  InvalidFeed = "user-feeds/invalid-feed",
}

/**
 * Test delivery constants matching user-feeds.
 */
export enum TestDeliveryMedium {
  Discord = "discord",
}

export enum TestDeliveryStatus {
  Success = "SUCCESS",
  ThirdPartyInternalError = "THIRD_PARTY_INTERNAL_ERROR",
  BadPayload = "BAD_PAYLOAD",
  MissingApplicationPermission = "MISSING_APPLICATION_PERMISSION",
  MissingChannel = "MISSING_CHANNEL",
  TooManyRequests = "TOO_MANY_REQUESTS",
  NoArticles = "NO_ARTICLES",
}

export enum DiscordSendArticleOperationType {
  CreateThreadOnMessage = "CREATE_THREAD_ON_MESSAGE",
}
