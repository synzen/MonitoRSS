import { baseMediumpayloadSchema } from "./base-medium-payload.type";
import { discordMediumPayloadDetailsSchema } from "./discord-medium-payload-details.type";
import { MediumFilters, mediumFiltersSchema } from "./medium-filters.type";
import { MediumKey, mediumKeySchema } from "./medium-key.type";
import {
  MediumRateLimit,
  mediumRateLimitSchema,
} from "./medium-rate-limits.type";
import { z } from "zod";

export const mediumPayloadSchema = baseMediumpayloadSchema.extend({
  id: z.string(),
  key: mediumKeySchema,
  filters: mediumFiltersSchema.optional().nullable(),
  rateLimits: z.array(mediumRateLimitSchema).optional().nullable(),
  details: discordMediumPayloadDetailsSchema,
});

export type MediumPayload = {
  id: string;
  key: MediumKey.Discord;
  filters?: MediumFilters | null;
  rateLimits?: MediumRateLimit[] | null;
  details: z.infer<typeof discordMediumPayloadDetailsSchema>;
};
