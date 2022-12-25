export interface FetchFeedDetailsDto {
  requestStatus: 'error' | 'success' | 'pending' | 'parse_error';
  response?: {
    statusCode: number;
    body?: string;
  };
}
