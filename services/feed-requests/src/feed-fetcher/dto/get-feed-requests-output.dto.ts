import { RequestStatus } from '../constants';

interface Request {
  id: number;
  status: RequestStatus;
  createdAt: number;
  nextRetryAtIso: string | null;
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
