import { GetArticlesResponseRequestStatus } from "./get-articles-response.type";

export interface GetArticlesOutput {
  requestStatus: GetArticlesResponseRequestStatus;
  articles: Array<Record<string, string>>;
}
