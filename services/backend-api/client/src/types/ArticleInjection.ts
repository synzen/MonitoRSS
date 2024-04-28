import { InferType, object, string } from "yup";

export const ExternalPropertySchema = object({
  id: string().required(),
  sourceField: string().required(),
  label: string().required(),
  cssSelector: string().required(),
});

export type ExternalProperty = InferType<typeof ExternalPropertySchema>;
