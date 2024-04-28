import { z } from "zod";

export const externalFeedPropertySchema = z.object({
  sourceField: z.string(),
  label: z.string(),
  cssSelector: z.string(),
});

export type ExternalFeedProperty = z.infer<typeof externalFeedPropertySchema>;
