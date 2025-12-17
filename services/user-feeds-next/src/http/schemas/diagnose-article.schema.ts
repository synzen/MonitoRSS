/**
 * Zod schema for POST /v1/user-feeds/diagnose-articles request
 */

import { z } from "zod";

/**
 * Date check options schema.
 */
const dateCheckOptionsSchema = z
  .object({
    oldArticleDateDiffMsThreshold: z.number().optional(),
  })
  .optional();

/**
 * Medium rate limit schema.
 */
const mediumRateLimitSchema = z.object({
  limit: z.number(),
  timeWindowSeconds: z.number(),
});

/**
 * Medium filter schema.
 * Uses unknown for expression since validation happens at runtime during evaluation.
 */
const mediumFiltersSchema = z
  .object({
    expression: z.unknown(),
  })
  .optional();

/**
 * Medium schema for diagnosis.
 */
const mediumSchema = z.object({
  id: z.string().min(1),
  rateLimits: z.array(mediumRateLimitSchema).optional(),
  filters: mediumFiltersSchema,
});

/**
 * Feed schema for diagnosis.
 */
const feedSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  blockingComparisons: z.array(z.string()).default([]),
  passingComparisons: z.array(z.string()).default([]),
  dateChecks: dateCheckOptionsSchema,
});

/**
 * Main input schema for diagnose-article endpoint.
 */
export const diagnoseArticleInputSchema = z.object({
  feed: feedSchema,
  mediums: z.array(mediumSchema).default([]),
  articleDayLimit: z.number().positive(),
  articleIds: z.array(z.string().min(1)).min(1).max(50),
  summaryOnly: z.boolean().default(false),
});

export type DiagnoseArticleInput = z.infer<typeof diagnoseArticleInputSchema>;
