export enum TestDeliveryStatus {
  Success = "SUCCESS",
  ThirdPartyInternalError = "THIRD_PARTY_INTERNAL_ERROR",
  BadPayload = "BAD_PAYLOAD",
  MissingApplicationPermission = "MISSING_APPLICATION_PERMISSION",
  MissingChannel = "MISSING_CHANNEL",
  TooManyRequests = "TOO_MANY_REQUESTS",
  NoArticles = "NO_ARTICLES",
}
