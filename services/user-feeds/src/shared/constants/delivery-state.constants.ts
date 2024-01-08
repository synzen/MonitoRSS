export enum ArticleDeliveryRejectedCode {
  BadRequest = "user-feeds/bad-request",
  Forbidden = "user-feeds/forbidden",
  MediumNotFound = "user-feeds/medium-not-found",
}

export enum ArticleDeliveryErrorCode {
  Internal = "user-feeds/internal-error",
  NoChannelOrWebhook = "user-feeds/no-channel-or-webhook",
  ThirdPartyInternal = "user-feeds/third-party-internal",
  ThirdPartyBadRequest = "user-feeds/third-party-bad-request",
  ThirdPartyForbidden = "user-feeds/third-party-forbidden",
  ThirdPartyNotFound = "user-feeds/third-party-not-found",
  ArticleProcessingError = "user-feeds/article-processing-error",
}
