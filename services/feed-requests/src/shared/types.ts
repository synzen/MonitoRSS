export enum RequestStatus {
  OK = 'OK',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  FETCH_ERROR = 'FETCH_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  BAD_STATUS_CODE = 'BAD_STATUS_CODE',
  FETCH_TIMEOUT = 'FETCH_TIMEOUT',
  REFUSED_LARGE_FEED = 'REFUSED_LARGE_FEED',
  MATCHED_HASH = 'MATCHED_HASH',
  INVALID_SSL_CERTIFICATE = 'INVALID_SSL_CERTIFICATE',
}

// The enum value is intentionally misspelled ("SHEDULE") — it is persisted in
// the database and must not be corrected.
export enum RequestSource {
  Schedule = 'SHEDULE',
}

export interface RequestFetchOptions {
  userAgent?: string;
  headers?: Record<string, string>;
}

export interface Response {
  id: number;
  statusCode: number;
  textHash?: string | null;
  hasCompressedText?: boolean;
  isCloudflare: boolean;
  s3ObjectKey?: string | null;
  redisCacheKey?: string | null;
  headers?: Record<string, string> | null;
  createdAt: Date;
  responseHashKey: string | null;
  content: string | null;
}

export interface Request {
  id: number;
  status: RequestStatus;
  source?: string | null;
  fetchOptions?: RequestFetchOptions | null;
  url: string;
  lookupKey: string | null;
  createdAt: Date;
  nextRetryDate: Date | null;
  errorMessage?: string | null;
  response: Response | null;
}

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
