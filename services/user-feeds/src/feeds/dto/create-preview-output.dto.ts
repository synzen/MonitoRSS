import { DiscordMessageApiPayload } from "../../delivery/types";
import { TestDeliveryStatus } from "../constants";

export class CreatePreviewOutputDto {
  status: TestDeliveryStatus;
  messages?: DiscordMessageApiPayload[];
  customPlaceholderPreviews?: string[][];
}
