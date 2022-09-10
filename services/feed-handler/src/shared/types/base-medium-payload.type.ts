import { object, InferType } from "yup";
import { mediumKeySchema } from "./medium-key.type";

export const baseMediumpayloadSchema = object({
  key: mediumKeySchema,
  details: object().required(),
});

export type BaseMediumPayload = InferType<typeof baseMediumpayloadSchema>;
