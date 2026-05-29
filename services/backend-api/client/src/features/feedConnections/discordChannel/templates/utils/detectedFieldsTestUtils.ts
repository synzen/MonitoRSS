import { DetectedFields, TemplateRequiredField } from "../types";

export const createEmptyDetectedFields = (): DetectedFields =>
  Object.fromEntries(
    Object.values(TemplateRequiredField).map((field) => [field, []]),
  ) as unknown as DetectedFields;

export const createDetectedFields = (overrides: Partial<DetectedFields> = {}): DetectedFields => ({
  ...createEmptyDetectedFields(),
  ...overrides,
});
