import { DetectedFields } from "../types/DetectedFields";
import { detectImageFields } from "./detectImageField";
import { detectDescriptionField } from "./detectDescriptionField";

export function detectFields(articles: Array<Record<string, unknown>>): DetectedFields {
  if (!articles || articles.length === 0) {
    return {
      image: [],
      description: [],
      title: [],
      author: [],
      link: [],
    };
  }

  const description = detectDescriptionField(articles[0]);

  return {
    image: detectImageFields(articles),
    description: description ? [description] : [],
    title: articles[0].title ? ["title"] : [],
    author: articles[0].author ? ["author"] : [],
    link: articles[0].link ? ["link"] : [],
  };
}
