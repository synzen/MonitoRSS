import {
  array, InferType, object, string,
} from 'yup';

const Placeholder = object({
  name: string(),
  value: string(),
});

export const FeedArticlesSchema = object({
  id: string(),
  title: string(),
  placeholders: array(Placeholder),
});

export type FeedArticle = InferType<typeof FeedArticlesSchema>;
