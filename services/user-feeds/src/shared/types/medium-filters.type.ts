import { object } from "yup";
import { LogicalExpression } from "../../article-filters/types";

export const mediumFiltersSchema = object({
  expression: object().required(),
});

export type MediumFilters = {
  expression: LogicalExpression;
};
