export enum TemplateRequiredField {
  Image = "image",
  Description = "description",
  Title = "title",
  Author = "author",
  Link = "link",
}

export interface DetectedImageField {
  field: string;
  presentInAll: boolean;
}

export type DetectedFields = {
  [TemplateRequiredField.Image]: DetectedImageField[];
  [TemplateRequiredField.Description]: string[];
  [TemplateRequiredField.Title]: string[];
  [TemplateRequiredField.Author]: string[];
  [TemplateRequiredField.Link]: string[];
};
