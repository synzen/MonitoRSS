/**
 * Handler for POST /v1/user-feeds/filter-validation
 * Validates filter expression syntax.
 */

import { z } from "zod";
import {
  validateFilterRegexes,
  validateLogicalExpression,
} from "../../articles/filters";
import { withAuth } from "../middleware";
import { jsonResponse, parseJsonBody } from "../utils";

const filterValidationInputSchema = z.object({
  expression: z.record(z.string(), z.unknown()),
});

export async function handleFilterValidation(req: Request): Promise<Response> {
  return withAuth(req, async () => {
    const body = await parseJsonBody<unknown>(req);
    const { expression } = filterValidationInputSchema.parse(body);

    const input = expression as Record<string, unknown>;
    const errors = [
      ...validateLogicalExpression(input, "root."),
      ...validateFilterRegexes(input, "root."),
    ];

    return jsonResponse({
      result: {
        errors,
      },
    });
  });
}
