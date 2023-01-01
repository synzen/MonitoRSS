/* eslint-disable max-len */
import { FeedFetcherRequestStatus } from "../../../services/feed-fetcher/types/feed-fetcher-request-status.type";

interface Request {
  id: number;
  status: FeedFetcherRequestStatus;
  createdAt: number;
}

interface Result {
  requests: Request[];
  // Unix timestamp
  nextRetryDate: number | null;
}

export interface GetUserFeedRequestsOutputDto {
  result: Result;
}
