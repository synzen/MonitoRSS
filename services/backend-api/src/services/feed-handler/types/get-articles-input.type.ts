export interface GetArticlesInput {
  url: string;
  limit: number;
  skip: number;
  random?: boolean;
  selectProperties?: string[];
  includeFilterResults?: boolean;
}
