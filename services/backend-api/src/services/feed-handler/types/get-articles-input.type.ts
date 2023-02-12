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
  };
  formatter: {
    options: {
      stripImages: boolean;
      formatTables: boolean;
      dateFormat: string | undefined;
    };
  };
}
