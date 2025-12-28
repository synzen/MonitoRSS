import { DetectedFields } from "../types/DetectedFields";
import { detectImageField } from "./detectImageField";
import { detectDescriptionField } from "./detectDescriptionField";

export function detectFields(articleSample?: Record<string, unknown> | null): DetectedFields {
  if (!articleSample) {
    return {
      image: null,
      description: null,
      title: null,
    };
  }

  return {
    image: detectImageField(articleSample),
    description: detectDescriptionField(articleSample),
    title: "title",
  };
}
