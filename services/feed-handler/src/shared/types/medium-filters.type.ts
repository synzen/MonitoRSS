import { object } from "yup";
import { LogicalExpression } from "../../article-filters/types";

export const mediumFiltersSchema = object({
  expression: object(),
});

export type MediumFilters = {
  expression?: LogicalExpression;
};
