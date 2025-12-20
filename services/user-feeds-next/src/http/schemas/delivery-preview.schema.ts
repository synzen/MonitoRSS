/**
 * Zod schema for POST /v1/user-feeds/delivery-preview request
 * Reuses schemas from feed-v2-event.schema.ts for consistency.
 */

import { z } from "zod";
import {
  feedV2EventSchemaFormatOptions,
  feedV2EventSchemaDateChecks,
  feedV2EventRequestLookupDetails,
  externalFeedPropertySchema,
} from "../../shared/schemas";

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
 * Medium schema for delivery preview.
 */
const mediumSchema = z.object({
  id: z.string().min(1),
  rateLimits: z.array(mediumRateLimitSchema).optional(),
  filters: mediumFiltersSchema,
});

/**
 * Feed schema for delivery preview.
 * Now includes all feed properties that affect processing:
 * - formatOptions: date formatting (dateFormat, dateTimezone, dateLocale)
 * - externalProperties: content injection from external sources
 * - requestLookupDetails: auth headers for feed fetching
 * - dateChecks: includes datePlaceholderReferences for custom date fields
 */
const feedSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  blockingComparisons: z.array(z.string()).default([]),
  passingComparisons: z.array(z.string()).default([]),
  dateChecks: feedV2EventSchemaDateChecks.optional(),
  formatOptions: feedV2EventSchemaFormatOptions.optional(),
  externalProperties: z.array(externalFeedPropertySchema).optional().default([]),
  requestLookupDetails: feedV2EventRequestLookupDetails.optional().nullable(),
});

/**
 * Main input schema for delivery-preview endpoint.
 */
export const deliveryPreviewInputSchema = z.object({
  feed: feedSchema,
  mediums: z.array(mediumSchema).default([]),
  articleDayLimit: z.number().positive(),
  skip: z.number().nonnegative().default(0),
  limit: z.number().positive().max(50).default(10),
  summaryOnly: z.boolean().default(false),
});

export type DeliveryPreviewInput = z.infer<typeof deliveryPreviewInputSchema>;
