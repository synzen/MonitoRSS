import { TestDeliveryStatus } from "../../../services/feed-handler/constants";

class ResultDto {
  status: TestDeliveryStatus;
  apiResponse?: Record<string, unknown>;
  apiPayload?: Record<string, unknown>;
}

export class CreateDiscordChannelConnectionTestArticleOutputDto {
  result: ResultDto;
}
