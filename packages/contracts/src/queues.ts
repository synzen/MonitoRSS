/**
 * Canonical enumeration of every RabbitMQ queue used across MonitoRSS services.
 *
 * This is the single source of truth — services MUST import from here instead
 * of redeclaring local enums or string literals.
 *
 * String values are the wire-format routing keys; do not change them without
 * coordinated migration across producers and consumers (see ADR-002, ADR-007).
 */
export enum MessageBrokerQueue {
  // URL fetch lifecycle (produced by backend-api/schedule-emitter, consumed by feed-requests + backend-api)
  UrlFetchBatch = "url.fetch-batch",
  UrlFetchCompleted = "url.fetch.completed",
  UrlFailing = "url.failing",
  UrlFailedDisableFeeds = "url.failed.disable-feeds",
  UrlRejectedDisableFeeds = "url.rejected.disable-feeds",

  // Article delivery lifecycle (between backend-api and user-feeds-next)
  FeedDeliverArticles = "feed.deliver-articles",
  FeedArticleDeliveryResult = "feed.article-delivery-result",
  FeedDeleted = "feed.deleted",
  FeedRejectedDisableFeed = "feed.rejected.disable-feed",
  FeedRejectedArticleDisableConnection = "feed.rejected-article.disable-connection",

  // Cross-cutting
  SyncSupporterDiscordRoles = "sync-supporter-discord-roles",
}
