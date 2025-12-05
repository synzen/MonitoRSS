export enum FeedResponseRequestStatus {
  InternalError = "INTERNAL_ERROR",
  ParseError = "PARSE_ERROR",
  Pending = "PENDING",
  Success = "SUCCESS",
  BadStatusCode = "BAD_STATUS_CODE",
  FetchError = "FETCH_ERROR",
  FetchTimeout = "FETCH_TIMEOUT",
  MatchedHash = "MATCHED_HASH",
}

interface FeedResponseInternalError {
  requestStatus: FeedResponseRequestStatus.InternalError;
}

interface FeedResponseMatchedHash {
  requestStatus: FeedResponseRequestStatus.MatchedHash;
}

interface FeedResponseFetchError {
  requestStatus: FeedResponseRequestStatus.FetchError;
}

interface FeedResponseBadStatusCodeError {
  requestStatus: FeedResponseRequestStatus.BadStatusCode;
  response: {
    statusCode: number;
  };
}

interface FeedResponseParseError {
  requestStatus: FeedResponseRequestStatus.ParseError;
  response: {
    statusCode: number;
  };
}

interface FeedResponsePending {
  requestStatus: FeedResponseRequestStatus.Pending;
}

interface FeedResponseSuccess {
  requestStatus: FeedResponseRequestStatus.Success;
  response: {
    body: string;
    hash: string;
    statusCode: number;
  };
}

export type FeedResponse =
  | FeedResponseInternalError
  | FeedResponseParseError
  | FeedResponsePending
  | FeedResponseSuccess
  | FeedResponseFetchError
  | FeedResponseBadStatusCodeError
  | FeedResponseMatchedHash;

export interface FeedRequestLookupDetails {
  key: string;
  url?: string;
  headers?: Record<string, string>;
}

export type FetchFeedResult =
  | { requestStatus: FeedResponseRequestStatus.Pending }
  | { requestStatus: FeedResponseRequestStatus.MatchedHash }
  | {
      requestStatus: FeedResponseRequestStatus.Success;
      body: string;
      bodyHash: string;
    };
