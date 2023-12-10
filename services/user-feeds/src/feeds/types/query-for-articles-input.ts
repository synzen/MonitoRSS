import { FormatOptions } from "../../article-formatter/types";
import { Article } from "../../shared";
import { GetUserFeedArticlesFilterReturnType } from "../constants";

export interface QueryForArticlesInput {
  limit: number;
  skip: number;
  articles: Article[];
  random?: boolean;
  selectProperties?: string[];
  customPlaceholders: FormatOptions["customPlaceholders"];
  filters?: {
    expression?: Record<string, unknown>;
    returnType: GetUserFeedArticlesFilterReturnType;
    articleId?: string;
    search?: string;
  };
}
