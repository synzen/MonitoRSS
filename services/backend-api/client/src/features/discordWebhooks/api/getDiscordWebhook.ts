import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordWebhookSchema } from "../types";

export interface GetDiscordWebhookInput {
  webhookId: string;
}

const GetDiscordWebhookOutputSchema = object({
  result: DiscordWebhookSchema.required(),
});

export type GetDiscordWebhookOutput = InferType<typeof GetDiscordWebhookOutputSchema>;

export const getDiscordWebhook = async (
  options: GetDiscordWebhookInput,
): Promise<GetDiscordWebhookOutput> => {
  const res = await fetchRest(`/api/v1/discord-webhooks/${options.webhookId}`, {
    validateSchema: GetDiscordWebhookOutputSchema,
  });

  return res as GetDiscordWebhookOutput;
};
