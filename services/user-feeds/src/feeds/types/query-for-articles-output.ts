export interface QueryForArticlesOutput {
  articles: Record<string, string>[];
  properties: string[];
  filterEvalResults?: Array<{ passed: boolean }>;
}
