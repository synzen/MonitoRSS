import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { CreatePreviewResultSchema } from "@/types";
import { CreateDiscordChannelConnectionPreviewInput } from "./createDiscordChannelConnectionPreview";

export type CreateDiscordWebhookConnectionPreviewInput = CreateDiscordChannelConnectionPreviewInput;

const CreateDiscordWebhookConnectionPreviewOutputSchema = object({
  result: CreatePreviewResultSchema,
}).required();

export type CreateDiscordWebhookConnectionPreviewOutput = InferType<
  typeof CreateDiscordWebhookConnectionPreviewOutputSchema
>;

export const createDiscordWebhookConnectionPreview = async (
  options: CreateDiscordWebhookConnectionPreviewInput
): Promise<CreateDiscordWebhookConnectionPreviewOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/` +
      `discord-webhooks/${options.connectionId}/preview`,
    {
      validateSchema: CreateDiscordWebhookConnectionPreviewOutputSchema,
      requestOptions: {
        method: "POST",
        body: JSON.stringify(options.data),
      },
    }
  );

  return res as CreateDiscordWebhookConnectionPreviewOutput;
};
