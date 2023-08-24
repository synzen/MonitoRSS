export enum GetFeedArticlesRequestStatus {
  ParseError = "PARSE_ERROR",
  Pending = "PENDING",
  Success = "SUCCESS",
  BadStatusCode = "BAD_STATUS_CODE",
  TimedOut = "TIMED_OUT",
  FetchError = "FETCH_ERROR",
}
