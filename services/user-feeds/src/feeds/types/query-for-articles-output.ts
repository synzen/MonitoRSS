export interface QueryForArticlesOutput {
  articles: Record<string, string>[];
  totalArticles: number;
  properties: string[];
  filterEvalResults?: Array<{ passed: boolean }>;
}
