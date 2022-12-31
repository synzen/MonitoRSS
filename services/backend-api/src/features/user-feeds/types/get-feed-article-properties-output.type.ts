import { GetArticlesResponseRequestStatus } from "../../../services/feed-handler/types";

export interface GetFeedArticlePropertiesOutput {
  properties: string[];
  requestStatus: GetArticlesResponseRequestStatus;
}
