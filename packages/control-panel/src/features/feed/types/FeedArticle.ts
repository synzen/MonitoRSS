import {
  array, InferType, object, string,
} from 'yup';

const Placeholder = object({
  name: string().required(),
  value: string().required(),
}).required();

export const FeedArticlesSchema = object({
  id: string().required(),
  title: string().required(),
  placeholders: array(Placeholder).required(),
}).required();

export type FeedArticle = InferType<typeof FeedArticlesSchema>;
