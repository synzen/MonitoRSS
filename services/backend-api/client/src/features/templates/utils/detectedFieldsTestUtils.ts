import { DetectedFields, DetectedImageField, TemplateRequiredField } from "../types";

export const createEmptyDetectedFields = (): DetectedFields =>
  ({
    [TemplateRequiredField.Image]: [],
    [TemplateRequiredField.Description]: [],
    [TemplateRequiredField.Title]: [],
    [TemplateRequiredField.Author]: [],
    [TemplateRequiredField.Link]: [],
  } as DetectedFields);

type DetectedFieldsOverrides = {
  [TemplateRequiredField.Image]?: string[] | DetectedImageField[];
  [TemplateRequiredField.Description]?: string[];
  [TemplateRequiredField.Title]?: string[];
  [TemplateRequiredField.Author]?: string[];
  [TemplateRequiredField.Link]?: string[];
};

export const createDetectedFields = (overrides: DetectedFieldsOverrides = {}): DetectedFields => {
  const base = createEmptyDetectedFields();
  const result = { ...base, ...overrides };

  if (overrides[TemplateRequiredField.Image]) {
    const imageOverride = overrides[TemplateRequiredField.Image];

    if (imageOverride.length > 0 && typeof imageOverride[0] === "string") {
      result[TemplateRequiredField.Image] = (imageOverride as string[]).map((field) => ({
        field,
        presentInAll: true,
      }));
    }
  }

  return result as DetectedFields;
};
