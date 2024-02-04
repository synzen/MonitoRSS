import { InferType, array, object, string } from "yup";
import { SendTestArticleDeliveryStatus } from "./SendTestArticleResult";
import { DiscordMessageApiPayloadSchema } from "./discord/DiscordApiPayload";

export const CreatePreviewResultSchema = object({
  status: string().oneOf(Object.values(SendTestArticleDeliveryStatus)).required(),
  messages: array(DiscordMessageApiPayloadSchema).default([]),
  customPlaceholderPreviews: array(array(string()).required()).optional(),
}).required();

export type CreatePreviewResult = InferType<typeof CreatePreviewResultSchema>;
