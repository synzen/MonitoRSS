import { object, InferType, string, array } from "yup";
import { baseMediumpayloadSchema } from "./base-medium-payload.type";
import { discordMediumPayloadDetailsSchema } from "./discord-medium-payload-details.type";
import { MediumFilters, mediumFiltersSchema } from "./medium-filters.type";
import { MediumKey, mediumKeySchema } from "./medium-key.type";
import {
  MediumRateLimit,
  mediumRateLimitSchema,
} from "./medium-rate-limits.type";

export const mediumPayloadSchema = baseMediumpayloadSchema.shape({
  id: string().required(),
  key: mediumKeySchema.required(),
  filters: mediumFiltersSchema.optional().nullable(),
  rateLimits: array(mediumRateLimitSchema.required())
    .nullable()
    .default(undefined),
  details: object()
    .oneOf(Object.values(MediumKey))
    .when("key", {
      is: MediumKey.Discord,
      then: () => discordMediumPayloadDetailsSchema,
    }),
});

export type MediumPayload = {
  id: string;
  key: MediumKey.Discord;
  filters?: MediumFilters | null;
  rateLimits?: MediumRateLimit[] | null;
  details: InferType<typeof discordMediumPayloadDetailsSchema>;
};
