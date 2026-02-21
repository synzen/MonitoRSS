export enum TemplateRequiredField {
  Image = "image",
  Description = "description",
  Title = "title",
  Author = "author",
  Link = "link",
}

export interface DetectedField {
  field: string;
  presentInAll: boolean;
}

export type DetectedFields = {
  [TemplateRequiredField.Image]: DetectedField[];
  [TemplateRequiredField.Description]: DetectedField[];
  [TemplateRequiredField.Title]: DetectedField[];
  [TemplateRequiredField.Author]: DetectedField[];
  [TemplateRequiredField.Link]: DetectedField[];
};
