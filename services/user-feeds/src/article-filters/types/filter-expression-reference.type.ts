import { Article } from "../../shared";
import { RelationalExpressionLeft } from "./relational-expression-left.type";

export type FilterExpressionReference = {
  [RelationalExpressionLeft.Article]: Article;
};
