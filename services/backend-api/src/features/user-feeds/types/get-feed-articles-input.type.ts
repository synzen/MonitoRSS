import { GetFeedArticlesFilterReturnType } from "../constants";

export interface GetFeedArticlesInput {
  limit: number;
  url: string;
  random?: boolean;
  selectProperties?: string[];
  skip?: number;
  filters?: {
    returnType: GetFeedArticlesFilterReturnType.IncludeEvaluationResults;
    expression?: Record<string, unknown>;
    search?: string;
  };
  formatter: {
    options: {
      stripImages: boolean;
      formatTables: boolean;
      dateFormat: string | undefined;
      dateTimezone: string | undefined;
      disableImageLinkPreviews: boolean;
      customPlaceholders:
        | Array<{
            id: string;
            regexSearch: string;
            replacementString: string;
            sourcePlaceholder: string;
          }>
        | undefined;
    };
  };
}
