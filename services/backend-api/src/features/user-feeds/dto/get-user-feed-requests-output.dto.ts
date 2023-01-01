/* eslint-disable max-len */
import { FeedFetcherRequestStatus } from "../../../services/feed-fetcher/types/feed-fetcher-request-status.type";

interface Request {
  id: number;
  status: FeedFetcherRequestStatus;
  createdAt: Date;
}

interface Result {
  requests: Request[];
  nextRetryDate: Date | null;
}

export interface GetUserFeedRequestsOutputDto {
  result: Result;
}
