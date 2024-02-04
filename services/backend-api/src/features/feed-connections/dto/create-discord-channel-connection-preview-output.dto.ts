import { TestDeliveryStatus } from "../../../services/feed-handler/constants";
import { DiscordMessageApiPayload } from "../../../services/feed-handler/types";

class ResultDto {
  status: TestDeliveryStatus;
  messages?: DiscordMessageApiPayload[];
  customPlaceholderPreviews: string[][];
}

export class CreateDiscordChannelConnectionPreviewOutputDto {
  result: ResultDto;
}
