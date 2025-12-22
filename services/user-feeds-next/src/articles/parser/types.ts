import type { ExternalContentError } from "./inject-external-content";

export interface FlattenedArticle {
  id: string;
  idHash: string;
  [key: string]: string;
}

export interface Article {
  flattened: FlattenedArticle;
  raw: {
    date?: string | null;
    pubdate?: string | null;
  };
}

export type FlattenedArticleWithoutId = Omit<FlattenedArticle, "id" | "idHash">;

export interface UserFeedFormatOptions {
  dateFormat?: string;
  dateTimezone?: string;
  dateLocale?: string;
  disableImageLinkPreviews?: boolean;
}

export enum PostProcessParserRule {
  RedditCommentLink = "reddit-comment-link",
}

export interface ParseArticlesResult {
  articles: Article[];
  feed: {
    title?: string;
  };
  externalContentErrors?: ExternalContentError[];
}

export const ARTICLE_FIELD_DELIMITER = "__";
