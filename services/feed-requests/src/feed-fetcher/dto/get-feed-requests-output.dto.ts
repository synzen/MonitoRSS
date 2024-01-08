import { RequestStatus } from '../constants';

interface Request {
  id: number;
  status: RequestStatus;
  createdAt: number;
}

interface Result {
  requests: Request[];
  nextRetryTimestamp: number | null;
}

export interface GetFeedRequestsOutputDto {
  result: Result;
}
