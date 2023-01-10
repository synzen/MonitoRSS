export enum FeedFetcherFetchStatus {
  Success = "SUCCESS",
  ParseError = "PARSE_ERROR",
  FetchError = "FETCH_ERROR",
  InteralError = "INTERNAL_ERROR",
  BadStatusCode = "BAD_STATUS_CODE",
  Pending = "PENDING",
}

interface FetchFeedResponseSuccess {
  requestStatus: FeedFetcherFetchStatus.Success;
  response: {
    body: string;
    statusCode: number;
  };
}

interface FetchFeedResponsePending {
  requestStatus: FeedFetcherFetchStatus.Pending;
}

interface FetchFeedResponseBadStatus {
  requestStatus: FeedFetcherFetchStatus.BadStatusCode;
  response?: {
    statusCode: number;
  };
}

interface FeedFetchResponseParseError {
  requestStatus: FeedFetcherFetchStatus.ParseError;
  response: {
    statusCode: number;
  };
}

export type FeedFetcherFetchFeedResponse =
  | FetchFeedResponseSuccess
  | FetchFeedResponseBadStatus
  | FetchFeedResponsePending
  | FeedFetchResponseParseError;
