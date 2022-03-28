import {
  array, InferType, object, string,
} from 'yup';

const Placeholder = object({
  name: string().required(),
  value: string().defined(),
}).required();

export const FeedArticlesSchema = object({
  id: string().required(),
  title: string().required(),
  placeholders: object({
    public: array(Placeholder).required(),
    private: array(Placeholder).required(),
    regex: array(Placeholder).required(),
    raw: array(Placeholder).required(),
  }).required(),
}).required();

export type FeedArticle = InferType<typeof FeedArticlesSchema>;
