import { GetFeedArticlesFilterReturnType } from "../constants";

export interface GetFeedArticlesInput {
  limit: number;
  url: string;
  random?: boolean;
  selectProperties?: string[];
  skip?: number;
  filters?: {
    returnType: GetFeedArticlesFilterReturnType.IncludeEvaluationResults;
    expression: Record<string, unknown>;
  };
}
