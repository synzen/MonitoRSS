export enum ArticleDeliveryRejectedCode {
  BadRequest = "handler/bad-request",
}

export enum ArticleDeliveryErrorCode {
  Internal = "handler/internal-error",
  NoChannelOrWebhook = "handler/no-channel-or-webhook",
  ThirdPartyInternal = "handler/third-party-internal",
}
