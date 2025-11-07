/* eslint-disable max-len */
import { DiscordSendArticleOperationType } from "../../delivery/types/discord-send-article-operation.type";
import { TestDeliveryStatus } from "../constants";

export class CreateTestArticleOutputDto {
  status: TestDeliveryStatus;
  apiPayload?: Record<string, unknown>;
  apiResponse?: unknown;
  operationType: DiscordSendArticleOperationType | undefined;
}
