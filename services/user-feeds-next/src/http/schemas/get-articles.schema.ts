/**
 * Zod schema for GET /v1/user-feeds/get-articles request
 * Matches user-feeds GetUserFeedArticlesInputDto
 */

import { z } from "zod";
import { CustomPlaceholderStepType } from "../../articles/formatter";

/**
 * Filter return type enum.
 */
export enum GetUserFeedArticlesFilterReturnType {
  IncludeEvaluationResults = "INCLUDE_EVAL_RESULTS",
}

/**
 * Select property type enum.
 */
export enum SelectPropertyType {
  Url = "url",
  ExternalInjections = "externalInjections",
}

/**
 * Custom placeholder step schema.
 * Matches user-feeds CustomPlaceholderStep discriminated union.
 */
const customPlaceholderStepSchema = z.union([
  z.object({
    type: z
      .literal(CustomPlaceholderStepType.Regex)
      .default(CustomPlaceholderStepType.Regex),
    regexSearch: z.string().min(1),
    regexSearchFlags: z.string().optional().nullable(),
    replacementString: z.string().optional().nullable(),
  }),
  z.object({ type: z.literal(CustomPlaceholderStepType.UrlEncode) }),
  z.object({
    type: z.literal(CustomPlaceholderStepType.DateFormat),
    format: z.string(),
    timezone: z.string().optional().nullable(),
    locale: z.string().optional().nullable(),
  }),
  z.object({ type: z.literal(CustomPlaceholderStepType.Uppercase) }),
  z.object({ type: z.literal(CustomPlaceholderStepType.Lowercase) }),
]);

/**
 * Custom placeholder schema.
 */
const customPlaceholderSchema = z.object({
  id: z.string(),
  referenceName: z.string(),
  sourcePlaceholder: z.string(),
  steps: z.array(customPlaceholderStepSchema),
});

/**
 * External feed property schema.
 */
const externalFeedPropertySchema = z.object({
  sourceField: z.string(),
  label: z.string(),
  cssSelector: z.string(),
});

/**
 * Formatter options schema.
 */
const formatterOptionsSchema = z.object({
  dateFormat: z.string().optional(),
  dateTimezone: z.string().optional(),
  dateLocale: z.string().optional(),
  stripImages: z.boolean().optional(),
  disableImageLinkPreviews: z.boolean().optional(),
  formatTables: z.boolean().optional(),
  ignoreNewLines: z.boolean().optional(),
  split: z
    .object({
      splitChar: z.string().optional().nullable(),
      appendChar: z.string().optional().nullable(),
      prependChar: z.string().optional().nullable(),
    })
    .optional(),
  customPlaceholders: z.array(customPlaceholderSchema).optional().nullable(),
});

/**
 * Formatter schema.
 */
const formatterSchema = z.object({
  options: formatterOptionsSchema,
  customPlaceholders: z.array(customPlaceholderSchema).optional().nullable(),
  externalProperties: z.array(externalFeedPropertySchema).optional().nullable(),
});

/**
 * Filters schema.
 */
const filtersSchema = z.object({
  returnType: z.enum(GetUserFeedArticlesFilterReturnType).optional(),
  expression: z.record(z.string(), z.unknown()).optional(),
  articleId: z.string().optional(),
  articleIdHashes: z.array(z.string()).optional(),
  search: z.string().optional(),
});

/**
 * Lookup details schema.
 */
const lookupDetailsSchema = z.object({
  key: z.string().min(1),
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

/**
 * Main get-articles input schema.
 */
export const getArticlesInputSchema = z.object({
  url: z.string().min(1),
  limit: z.number().int().positive(),
  skip: z.number().int().min(0).max(1000).default(0),
  random: z.boolean().optional(),
  selectProperties: z.array(z.string()).optional(),
  selectPropertyTypes: z.array(z.nativeEnum(SelectPropertyType)).optional(),
  filters: filtersSchema.optional(),
  formatter: formatterSchema,
  findRssFromHtml: z.boolean().optional(),
  executeFetch: z.boolean().optional(),
  requestLookupDetails: lookupDetailsSchema.optional().nullable(),
  executeFetchIfStale: z.boolean().optional(),
  /** Include raw HTML in NO_SELECTOR_MATCH errors for troubleshooting (preview mode only) */
  includeHtmlInErrors: z.boolean().optional(),
});

export type GetArticlesInput = z.infer<typeof getArticlesInputSchema>;
export type CustomPlaceholder = z.infer<typeof customPlaceholderSchema>;
export type ExternalFeedProperty = z.infer<typeof externalFeedPropertySchema>;
