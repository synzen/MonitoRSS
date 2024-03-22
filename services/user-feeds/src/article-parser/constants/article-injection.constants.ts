import { z } from "zod";

export const articleInjectionSchema = z.object({
  sourceField: z.string(),
  fields: z.array(
    z.object({
      name: z.string(),
      cssSelector: z.string(),
    })
  ),
});

export type ArticleInjection = z.infer<typeof articleInjectionSchema>;
