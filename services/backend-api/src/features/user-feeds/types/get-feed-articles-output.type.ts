import { GetArticlesResponseRequestStatus } from "../../../services/feed-handler/types";

export interface GetFeedArticlesOutput {
  requestStatus: GetArticlesResponseRequestStatus;
  articles: Array<Record<string, string>>;
}
