import { InferType, array, object, string } from "yup";

export const ArticleInjectionSchema = object({
  id: string().required(),
  sourceField: string().required(),
  fields: array(
    object({
      id: string().required(),
      name: string().required(),
      cssSelector: string().required(),
    })
  ).required(),
});

export type ArticleInjection = InferType<typeof ArticleInjectionSchema>;
