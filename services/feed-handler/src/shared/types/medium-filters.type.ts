import { object } from "yup";
import { FilterLogicalExpression } from "../../article-filters/article-filterse.constants";

export const mediumFiltersSchema = object({
  expression: object(),
});

export type MediumFilters = {
  expression?: FilterLogicalExpression;
};
