import { RequestStatus } from '../../feed-fetcher/constants';
import { RequestSource } from '../../feed-fetcher/constants/request-source.constants';

export interface PartitionedRequestInsert {
  id: string;
  status: RequestStatus;
  source: RequestSource | null;
  fetchOptions: object | null;
  url: string;
  lookupKey: string | null;
  createdAt: Date;
  nextRetryDate: Date | null;
  errorMessage: string | null;
  requestInitiatedAt: Date | null;
  response: null | {
    statusCode: number;
    textHash: string | null;
    s3ObjectKey: string | null;
    redisCacheKey: string | null;
    headers: object;
    body: {
      hashKey: string;
      contents: string;
    } | null;
  };
}
