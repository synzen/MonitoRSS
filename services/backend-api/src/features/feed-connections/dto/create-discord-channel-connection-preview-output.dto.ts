import { TestDeliveryStatus } from "../../../services/feed-handler/constants";
import { DiscordMessageApiPayload } from "../../../services/feed-handler/types";

class ResultDto {
  status: TestDeliveryStatus;
  messages?: DiscordMessageApiPayload[];
}

export class CreateDiscordChannelConnectionPreviewOutputDto {
  result: ResultDto;
}
