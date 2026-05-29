import { InferType, array, object } from "yup";
import { CustomPlaceholderSchema } from "@/types/CustomPlaceholder";

export const CustomPlaceholdersFormSchema = object({
  customPlaceholders: array(CustomPlaceholderSchema.required()).required(),
});

export type CustomPlaceholdersFormData = InferType<typeof CustomPlaceholdersFormSchema>;
