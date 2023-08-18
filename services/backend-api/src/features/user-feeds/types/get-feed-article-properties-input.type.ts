import { UserFeed } from "../entities";

export interface GetFeedArticlePropertiesInput {
  url: string;
  feed: UserFeed;
}
