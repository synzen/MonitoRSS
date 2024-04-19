import { CustomPlaceholderDto } from "../../../common";
import {
  GetFeedArticlesFilterReturnType,
  SelectArticlePropertyType,
} from "../constants";

export interface GetFeedArticlesInput {
  limit: number;
  url: string;
  random?: boolean;
  selectProperties?: string[];
  selectPropertyTypes?: SelectArticlePropertyType[];
  skip?: number;
  discordUserId: string;
  filters?: {
    returnType: GetFeedArticlesFilterReturnType.IncludeEvaluationResults;
    expression?: Record<string, unknown>;
    search?: string;
  };
  formatter: {
    customPlaceholders?: Array<CustomPlaceholderDto> | null;
    articleInjections?: Array<{
      sourceField: string;
      selectors: Array<{
        label: string;
        cssSelector: string;
      }>;
    }> | null;
    options: {
      stripImages: boolean;
      formatTables: boolean;
      dateFormat: string | undefined;
      dateTimezone: string | undefined;
      dateLocale: string | undefined;
      disableImageLinkPreviews: boolean;
    };
  };
}
