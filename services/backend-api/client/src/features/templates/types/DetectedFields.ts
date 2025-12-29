export enum TemplateRequiredField {
  Image = "image",
  Description = "description",
  Title = "title",
}

export type DetectedFields = Record<TemplateRequiredField, string[]>;
