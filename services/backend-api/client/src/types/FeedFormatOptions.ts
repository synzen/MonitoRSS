import { ExternalProperty } from "./ArticleInjection";

export interface FeedFormatOptions {
  externalProperties?: ExternalProperty[] | null;
  formatTables: boolean;
  stripImages: boolean;
  dateFormat?: string;
  dateTimezone?: string;
  disableImageLinkPreviews?: boolean;
  ignoreNewLines?: boolean;
}
