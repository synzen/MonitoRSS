export enum ApiErrorCode {
  INVALID_FEED = 'INVALID_FEED',
  PARSE_FAILED = 'PARSE_FAILED',
  PARSE_TIMEOUT = 'PARSE_TIMEOUT',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  REQUEST_FAILED = 'REQUEST_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_FEED: 'Invalid feed',
  PARSE_FAILED: 'Failed to parse feed',
  PARSE_TIMEOUT: 'Failed to parse feed due to timeout',
  REQUEST_TIMEOUT: 'Failed to request feed due to timeout',
  REQUEST_FAILED: 'Failed to request feed',
  INTERNAL_ERROR: 'Internal error',
};
