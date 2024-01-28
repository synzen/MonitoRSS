import { LogicalExpression } from "../../article-filters/types";
import { z } from "zod";

export const mediumFiltersSchema = z.object({
  expression: z.object({}).passthrough(),
});

export type MediumFilters = {
  expression: LogicalExpression;
};
