import { FeedResponseRequestStatus } from "../../shared";

interface FeedResponseInernalError {
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
  | FeedResponseInernalError
  | FeedResponseParseError
  | FeedResponsePending
  | FeedResponseSuccess
  | FeedResponseFetchError
  | FeedResponseBadStatusCodeError
  | FeedResponseMatchedHash;
