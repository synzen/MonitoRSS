import { object, InferType } from "yup";
import { baseMediumpayloadSchema } from "./base-medium-payload.type";
import { discordMediumPayloadDetailsSchema } from "./discord-medium-payload-details.type";
import { MediumKey, mediumKeySchema } from "./medium-key.type";

export const mediumPayloadSchema = baseMediumpayloadSchema.shape({
  key: mediumKeySchema.required(),
  details: object()
    .oneOf(Object.values(MediumKey))
    .when("key", {
      is: MediumKey.Discord,
      then: () => discordMediumPayloadDetailsSchema,
    }),
});

export type MediumPayload = {
  key: MediumKey.Discord;
  details: InferType<typeof discordMediumPayloadDetailsSchema>;
};
