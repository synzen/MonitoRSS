import { FeedResponseRequestStatus } from "../../shared";

interface FeedResponseError {
  requestStatus: FeedResponseRequestStatus.Error;
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
    statusCode: number;
  };
}

export type FeedResponse =
  | FeedResponseError
  | FeedResponseParseError
  | FeedResponsePending
  | FeedResponseSuccess;
