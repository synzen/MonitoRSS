export interface FetchFeedDetailsDto {
  requestStatus: 'error' | 'success' | 'pending';
  response?: {
    statusCode: number;
    body: string;
  };
}
