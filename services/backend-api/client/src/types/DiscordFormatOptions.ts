import { ExternalProperty } from "./ArticleInjection";
import { CustomPlaceholder } from "./CustomPlaceholder";

export interface DiscordFormatOptions {
  customPlaceholders?: CustomPlaceholder[] | null;
  externalProperties?: ExternalProperty[] | null;
  formatTables: boolean;
  stripImages: boolean;
  dateFormat?: string;
  dateTimezone?: string;
  disableImageLinkPreviews?: boolean;
  ignoreNewLines?: boolean;
}
