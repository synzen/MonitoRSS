import { DetectedFields } from "../types/DetectedFields";
import { detectImageFields, detectVideoFields } from "./detectImageField";
import { detectDescriptionField } from "./detectDescriptionField";

export function detectFields(articles: Array<Record<string, unknown>>): DetectedFields {
  if (!articles || articles.length === 0) {
    return {
      image: [],
      video: [],
      description: [],
      title: [],
      author: [],
      link: [],
    };
  }

  const description = detectDescriptionField(articles[0]);

  return {
    image: detectImageFields(articles),
    video: detectVideoFields(articles),
    description: description ? [{ field: description, presentInAll: true }] : [],
    title: articles[0].title ? [{ field: "title", presentInAll: true }] : [],
    author: articles[0].author ? [{ field: "author", presentInAll: true }] : [],
    link: articles[0].link ? [{ field: "link", presentInAll: true }] : [],
  };
}
