import { TestDeliveryStatus } from "../../../services/feed-handler/constants";

export class CreateDiscordWebhookConnectionTestArticleOutputDto {
  status: TestDeliveryStatus;
  apiResponse?: unknown;
}
