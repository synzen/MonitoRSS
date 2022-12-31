import { Article } from "../../shared";

export interface QueryForArticlesInput {
  limit: number;
  skip: number;
  articles: Article[];
  random?: boolean;
  includeFilterResults?: boolean;
  selectProperties?: string[];
}
