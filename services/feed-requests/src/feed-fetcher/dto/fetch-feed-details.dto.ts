export interface FetchFeedDetailsDto {
  requestStatus:
    | 'INTERNAL_ERROR'
    | 'BAD_STATUS_CODE'
    | 'SUCCESS'
    | 'PENDING'
    | 'FETCH_ERROR'
    | 'PARSE_ERROR';
  response?: {
    statusCode: number;
    body?: string;
  };
}
