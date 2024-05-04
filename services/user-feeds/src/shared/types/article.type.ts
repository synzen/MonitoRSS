import { FlattenedArticle } from "./flattened-article.type";

export interface Article {
  flattened: FlattenedArticle;
  raw: {
    date?: string | null;
    pubdate?: string | null;
  };
}
