import { FormatOptions } from "../../article-formatter/types";
import { Article } from "../../shared";
import { GetUserFeedArticlesFilterReturnType } from "../constants";
import { SelectPropertyType } from "../constants/select-property-type.constants";

export interface QueryForArticlesInput {
  limit: number;
  skip: number;
  articles: Article[];
  random?: boolean;
  selectProperties?: string[];
  customPlaceholders: FormatOptions["customPlaceholders"];
  selectPropertyTypes?: SelectPropertyType[];
  filters?: {
    expression?: Record<string, unknown>;
    returnType: GetUserFeedArticlesFilterReturnType;
    articleId?: string;
    articleIdHashes?: string[];
    search?: string;
  };
}
