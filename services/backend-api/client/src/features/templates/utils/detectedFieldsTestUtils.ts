import { DetectedFields, TemplateRequiredField } from "../types";

export const createEmptyDetectedFields = (): DetectedFields =>
  Object.values(TemplateRequiredField).reduce(
    (acc, field) => ({ ...acc, [field]: [] }),
    {} as DetectedFields,
  );

export const createDetectedFields = (
  overrides: Partial<Record<TemplateRequiredField, string[]>> = {},
): DetectedFields => ({
  ...createEmptyDetectedFields(),
  ...overrides,
});
