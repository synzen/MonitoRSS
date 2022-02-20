import { z } from 'zod';

const Placeholder = z.object({
  name: z.string(),
  value: z.string(),
});

export const FeedArticlesSchema = z.object({
  placeholders: z.array(Placeholder),
});

export type FeedArticle = z.infer<typeof FeedArticlesSchema>;
