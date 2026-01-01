export enum TemplateRequiredField {
  Image = "image",
  Description = "description",
  Title = "title",
  Author = "author",
  Link = "link",
}

export type DetectedFields = Record<TemplateRequiredField, string[]>;
