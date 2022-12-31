export interface GetFeedArticlesInput {
  limit: number;
  url: string;
  random?: boolean;
  selectProperties?: string[];
  skip?: number;
  includeFilterResults?: boolean;
}
