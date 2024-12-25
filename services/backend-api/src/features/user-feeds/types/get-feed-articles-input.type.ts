import { CustomPlaceholderDto } from "../../../common";
import { GetFeedArticlesFilterReturnType } from "../constants";
import { UserFeed } from "../entities";

export interface GetFeedArticlesInput {
  feed: UserFeed;
  limit: number;
  url: string;
  random?: boolean;
  selectProperties?: string[];
  selectPropertyTypes?: string[];
  skip?: number;
  discordUserId: string;
  filters?: {
    returnType: GetFeedArticlesFilterReturnType.IncludeEvaluationResults;
    expression?: Record<string, unknown>;
    search?: string;
  };
  formatter: {
    customPlaceholders?: Array<CustomPlaceholderDto> | null;
    externalProperties?: Array<{
      sourceField: string;
      label: string;
      cssSelector: string;
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
