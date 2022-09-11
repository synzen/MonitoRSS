import { object, InferType } from "yup";
import { baseMediumpayloadSchema } from "./base-medium-payload.type";
import { discordMediumPayloadDetailsSchema } from "./discord-medium-payload-details.type";
import { MediumFilters, mediumFiltersSchema } from "./medium-filters.type";
import { MediumKey, mediumKeySchema } from "./medium-key.type";

export const mediumPayloadSchema = baseMediumpayloadSchema.shape({
  key: mediumKeySchema.required(),
  filters: mediumFiltersSchema,
  details: object()
    .oneOf(Object.values(MediumKey))
    .when("key", {
      is: MediumKey.Discord,
      then: () => discordMediumPayloadDetailsSchema,
    }),
});

export type MediumPayload = {
  key: MediumKey.Discord;
  filters: MediumFilters;
  details: InferType<typeof discordMediumPayloadDetailsSchema>;
};
