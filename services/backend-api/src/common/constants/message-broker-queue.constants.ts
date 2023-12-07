export enum MessageBrokerQueue {
  UrlFetch = "url.fetch",
  UrlFetchCompleted = "url.fetch.completed",
  UrlFetchBatch = "url.fetch-batch",
  UrlFailedDisableFeeds = "url.failed.disable-feeds",
  UrlRejectedDisableFeeds = "url.rejected.disable-feeds",
  FeedRejectedArticleDisableConnection = "feed.rejected-article.disable-connection",
  FeedDeliverArticles = "feed.deliver-articles",
  FeedDeleted = "feed.deleted",
  FeedRejectedDisableFeed = "feed.rejected.disable-feed",
  SupportServerMemberJoined = "support-server-member-joined",
}
