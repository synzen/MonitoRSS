import { Article } from "../../shared";
import { GetUserFeedArticlesFilterReturnType } from "../constants";

export interface QueryForArticlesInput {
  limit: number;
  skip: number;
  articles: Article[];
  random?: boolean;
  selectProperties?: string[];
  filters?: {
    expression?: Record<string, unknown>;
    returnType: GetUserFeedArticlesFilterReturnType;
  };
}
