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
 * Message broker queue names for RabbitMQ.
 */
export enum MessageBrokerQueue {
  FeedDeliverArticles = "feed.deliver-articles",
  FeedArticleDeliveryResult = "feed.article-delivery-result",
  FeedRejectedArticleDisableConnection = "feed.rejected-article.disable-connection",
  FeedDeleted = "feed.deleted",
}
