import { z } from "zod";

export const externalFeedPropertySchema = z.object({
  sourceField: z.string(),
  selectors: z.array(
    z.object({
      label: z.string(),
      cssSelector: z.string(),
    })
  ),
});

export type ExternalFeedProperty = z.infer<typeof externalFeedPropertySchema>;
