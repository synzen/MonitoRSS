import { DetectedFields, Template } from "../../types";

export function isTemplateCompatible(
  template: Template,
  feedFields: string[],
  detectedFields: DetectedFields
): boolean {
  const andFieldsSatisfied =
    !template.requiredFields?.length ||
    template.requiredFields.every((field) => {
      return detectedFields[field].length > 0 || feedFields.includes(field);
    });

  const orFieldsSatisfied =
    !template.requiredFieldsOr?.length ||
    template.requiredFieldsOr.some((field) => {
      return detectedFields[field].length > 0 || feedFields.includes(field);
    });

  return andFieldsSatisfied && orFieldsSatisfied;
}

export function getMissingFields(
  template: Template,
  feedFields: string[],
  detectedFields: DetectedFields
): string[] {
  const missingAndFields = (template.requiredFields ?? []).filter((field) => {
    return detectedFields[field].length === 0 && !feedFields.includes(field);
  });

  const orFields = template.requiredFieldsOr ?? [];
  const orSatisfied =
    orFields.length === 0 ||
    orFields.some((field) => detectedFields[field].length > 0 || feedFields.includes(field));

  if (!orSatisfied) {
    return [...missingAndFields, orFields.join(" or ")];
  }

  return missingAndFields;
}

export function getDisabledReason(
  template: Template,
  feedFields: string[],
  detectedFields: DetectedFields
): string {
  const missingFields = getMissingFields(template, feedFields, detectedFields);

  if (missingFields.length === 0) {
    return "";
  }

  // If feedFields is empty (no articles), use generic message per spec
  if (feedFields.length === 0) {
    return "Needs articles";
  }

  // If articles exist but specific fields are missing, show which fields
  return `Needs: ${missingFields.join(", ")}`;
}
