interface FeedResponseError {
  requestStatus: "error";
}

interface FeedResponseParseError {
  requestStatus: "parse_error";
  response: {
    statusCode: number;
  };
}

interface FeedResponsePending {
  requestStatus: "pending";
}

interface FeedResponseSuccess {
  requestStatus: "success";
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
