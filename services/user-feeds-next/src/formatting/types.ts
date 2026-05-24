import type { FlattenedArticle } from "../articles/parser";

export enum CustomPlaceholderStepType {
  UrlEncode = "URL_ENCODE",
  DateFormat = "DATE_FORMAT",
  Regex = "REGEX",
  Uppercase = "UPPERCASE",
  Lowercase = "LOWERCASE",
}

export interface CustomPlaceholderStep {
  type: CustomPlaceholderStepType;
  regexSearch?: string;
  regexSearchFlags?: string;
  replacementString?: string;
  format?: string;
  timezone?: string;
  locale?: string;
}

export interface CustomPlaceholder {
  id: string;
  referenceName: string;
  sourcePlaceholder: string;
  steps: CustomPlaceholderStep[];
}

export interface PlaceholderLimit {
  placeholder: string;
  characterCount: number;
  appendString?: string;
}

export interface SplitOptions {
  splitChar?: string;
  appendChar?: string;
  prependChar?: string;
  limit?: number;
  isEnabled?: boolean;
}

export interface FormatOptions {
  stripImages?: boolean;
  formatTables?: boolean;
  disableImageLinkPreviews?: boolean;
  ignoreNewLines?: boolean;
  customPlaceholders?: CustomPlaceholder[];
  connectionCreatedAt?: string;
}

export interface ProcessCustomPlaceholdersResult {
  flattened: FlattenedArticle;
  previews: string[][];
}

export interface GenerateTextOptions {
  content: string | undefined;
  limit?: number;
  flattened: Record<string, string | undefined>;
  enablePlaceholderFallback?: boolean;
}
