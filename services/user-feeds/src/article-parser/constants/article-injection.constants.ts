import { z } from "zod";

export const articleInjectionSchema = z.object({
  sourceField: z.string(),
  selectors: z.array(
    z.object({
      label: z.string(),
      cssSelector: z.string(),
    })
  ),
});

export type ArticleInjection = z.infer<typeof articleInjectionSchema>;
