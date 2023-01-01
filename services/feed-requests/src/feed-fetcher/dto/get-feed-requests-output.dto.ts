import { RequestStatus } from '../constants';

interface Request {
  id: number;
  status: RequestStatus;
  createdAt: Date;
}

interface Result {
  requests: Request[];
  nextRetryDate: Date | null;
}

export interface GetFeedRequestsOutputDto {
  result: Result;
}
