import { FeedStatus } from "../../feeds/types/FeedStatus.type";

interface FeedSummary {
  id: string;
  title: string;
  status: FeedStatus;
  url: string;
  channel: string;
  createdAt?: string;
}

export interface GetServerFeedsOutputDto {
  results: FeedSummary[];
  total: number;
}
