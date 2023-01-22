import { Article } from "../../shared";

export interface QueryForArticlesOutput {
  articles: Article[];
  totalArticles: number;
  properties: string[];
  filterEvalResults?: Array<{ passed: boolean }>;
}
