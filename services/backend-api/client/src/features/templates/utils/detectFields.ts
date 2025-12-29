import { DetectedFields } from "../types/DetectedFields";
import { detectImageFields } from "./detectImageField";
import { detectDescriptionField } from "./detectDescriptionField";

export function detectFields(articles: Array<Record<string, unknown>>): DetectedFields {
  if (!articles || articles.length === 0) {
    return {
      image: [],
      description: [],
      title: [],
    };
  }

  const description = detectDescriptionField(articles[0]);

  return {
    image: detectImageFields(articles),
    description: description ? [description] : [],
    title: ["title"],
  };
}
