/* eslint-disable max-len */
import { FeedFetcherRequestStatus } from "../../../services/feed-fetcher/types/feed-fetcher-request-status.type";

interface Request {
  id: string;
  status: FeedFetcherRequestStatus;
  createdAt: number;
  response: {
    statusCode?: number;
  };
}

interface Result {
  requests: Request[];
  // Unix timestamp
  nextRetryTimestamp: number | null;
}

export interface GetUserFeedRequestsOutputDto {
  result: Result;
}
