import { CustomPlaceholderDto } from "../../../common";
import { UserFeed } from "../entities";

export interface GetFeedArticlePropertiesInput {
  feed: UserFeed;
  url: string;
  customPlaceholders?: CustomPlaceholderDto[] | null;
}
