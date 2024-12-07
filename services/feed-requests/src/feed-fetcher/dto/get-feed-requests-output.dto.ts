import { RequestStatus } from '../constants';

interface Request {
  id: number;
  status: RequestStatus;
  createdAt: number;
}

interface Result {
  requests: Request[];
  nextRetryTimestamp: number | null;
  feedHostGlobalRateLimit: null | {
    requestLimit: number;
    intervalSec: number;
  };
}

export interface GetFeedRequestsOutputDto {
  result: Result;
}
