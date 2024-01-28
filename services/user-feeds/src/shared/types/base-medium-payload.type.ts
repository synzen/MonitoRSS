import { mediumKeySchema } from "./medium-key.type";
import { z } from "zod";

export const baseMediumpayloadSchema = z.object({
  key: mediumKeySchema,
  details: z.object({}).passthrough(),
});

export type BaseMediumPayload = z.infer<typeof baseMediumpayloadSchema>;
