import { RequestStatus } from '../constants';

interface Request {
  id: number;
  status: RequestStatus;
  createdAt: number;
}

interface Result {
  requests: Request[];
  totalRequests: number;
  nextRetryDate: number | null;
}

export interface GetFeedRequestsOutputDto {
  result: Result;
}
