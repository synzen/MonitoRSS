export enum UserFeedArticleRequestStatus {
  ParseError = "PARSE_ERROR",
  Pending = "PENDING",
  Success = "SUCCESS",
  BadStatusCode = "BAD_STATUS_CODE",
  FetchError = "FETCH_ERROR",
  TimedOut = "TIMED_OUT",
  FetchTimeout = "FETCH_TIMEOUT",
  InvalidSslCert = "INVALID_SSL_CERTIFICATE",
}
