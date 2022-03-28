interface FeedSummary {
  id: string;
  title: string;
  status: 'ok' | 'failed' | 'disabled';
  url: string;
  channel: string;
  createdAt?: string;
}

export interface GetServerFeedsOutputDto {
  results: FeedSummary[];
  total: number;
}
