export enum UserFeedUrlRequestStatus {
  Success = "SUCCESS",
  ParseError = "PARSE_ERROR",
  FetchError = "FETCH_ERROR",
  FetchTimeout = "FETCH_TIMEOUT",
  InteralError = "INTERNAL_ERROR",
  BadStatusCode = "BAD_STATUS_CODE",
  Pending = "PENDING",
  RefusedLargeFeed = "REFUSED_LARGE_FEED",
  InvalidSslCertificate = "INVALID_SSL_CERTIFICATE",
}
