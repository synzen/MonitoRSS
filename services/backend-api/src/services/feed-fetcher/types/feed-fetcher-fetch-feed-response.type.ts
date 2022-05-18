interface FetchFeedResponseSuccess {
  requestStatus: 'success';
  response: {
    body: string;
    statusCode: number;
  };
}

interface FetchFeedResponsePending {
  requestStatus: 'pending';
}

interface FetchFeedResponseError {
  requestStatus: 'error';
}

interface FeedFetchResponseParseError {
  requestStatus: 'parse_error';
  response: {
    statusCode: number;
  };
}

export type FeedFetcherFetchFeedResponse =
  | FetchFeedResponseSuccess
  | FetchFeedResponseError
  | FetchFeedResponsePending
  | FeedFetchResponseParseError;
