import { object, InferType, string } from "yup";
import { baseMediumpayloadSchema } from "./base-medium-payload.type";
import { discordMediumPayloadDetailsSchema } from "./discord-medium-payload-details.type";
import { MediumFilters, mediumFiltersSchema } from "./medium-filters.type";
import { MediumKey, mediumKeySchema } from "./medium-key.type";

export const mediumPayloadSchema = baseMediumpayloadSchema.shape({
  id: string().required(),
  key: mediumKeySchema.required(),
  filters: mediumFiltersSchema.optional().nullable(),
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
  details: InferType<typeof discordMediumPayloadDetailsSchema>;
};
