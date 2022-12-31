import { GetArticlesResponseRequestStatus } from "../../../services/feed-handler/types";

class Result {
  properties: string[];
  requestStatus: GetArticlesResponseRequestStatus;
}

export class GetUserFeedArticlePropertiesOutputDto {
  result: Result;
}
