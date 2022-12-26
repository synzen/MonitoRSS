import { TestDeliveryStatus } from "../../../services/feed-handler/constants";

export class CreateDiscordChannelConnectionTestArticleOutputDto {
  status: TestDeliveryStatus;
  apiResponse?: unknown;
}
