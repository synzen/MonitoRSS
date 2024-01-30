import { CustomPlaceholderDto } from "../../../common";
import { GetFeedArticlesFilterReturnType } from "../../../features/user-feeds/constants";

export interface GetArticlesInput {
  url: string;
  limit: number;
  skip: number;
  random?: boolean;
  selectProperties?: string[];
  filters?: {
    expression?: Record<string, unknown>;
    returnType: GetFeedArticlesFilterReturnType;
    search?: string;
  };
  formatter: {
    options: {
      stripImages: boolean;
      formatTables: boolean;
      dateFormat: string | undefined;
      dateTimezone: string | undefined;
      dateLocale: string | undefined;
      disableImageLinkPreviews: boolean;
    };
    customPlaceholders?: CustomPlaceholderDto[] | null;
  };
}
