import { CustomPlaceholderDto } from "../../../common";

export interface GetFeedArticlePropertiesInput {
  url: string;
  customPlaceholders?: CustomPlaceholderDto[] | null;
}
