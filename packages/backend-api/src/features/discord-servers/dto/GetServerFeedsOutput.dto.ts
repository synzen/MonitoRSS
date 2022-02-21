interface FeedSummary {
  id: string;
  title: string;
  status: 'ok' | 'failed';
  url: string;
  channel: string;
  createdAt?: string;
}

export interface GetServerFeedsOutputDto {
  results: FeedSummary[];
  total: number;
}
