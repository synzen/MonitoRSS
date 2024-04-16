import { InferType, array, object, string } from "yup";

export const ArticleInjectionSchema = object({
  id: string().required(),
  sourceField: string().required(),
  selectors: array(
    object({
      id: string().required(),
      label: string().required(),
      cssSelector: string().required(),
    })
  ).required(),
});

export type ArticleInjection = InferType<typeof ArticleInjectionSchema>;
