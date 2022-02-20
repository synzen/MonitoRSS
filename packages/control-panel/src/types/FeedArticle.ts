import { z } from 'zod';

const Placeholder = z.object({
  name: z.string(),
  value: z.string(),
});

export const FeedArticlesSchema = z.object({
  id: z.string(),
  title: z.string(),
  placeholders: z.array(Placeholder),
});

export type FeedArticle = z.infer<typeof FeedArticlesSchema>;
