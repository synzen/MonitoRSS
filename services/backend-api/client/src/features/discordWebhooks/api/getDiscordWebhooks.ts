import { array, InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordWebhookSchema } from "../types";

export interface GetDiscordWebhooksInput {
  serverId: string;
}

const GetDiscordWebhooksOutputSchema = object({
  results: array(DiscordWebhookSchema).required(),
});

export type GetDiscordWebhooksOutput = InferType<typeof GetDiscordWebhooksOutputSchema>;

export const getDiscordWebhooks = async (
  options: GetDiscordWebhooksInput
): Promise<GetDiscordWebhooksOutput> => {
  const params = new URLSearchParams();
  params.append("filters[serverId]", options.serverId);

  const query = params.toString();

  const res = await fetchRest(`/api/v1/discord-webhooks?${query}`, {
    validateSchema: GetDiscordWebhooksOutputSchema,
  });

  return res as GetDiscordWebhooksOutput;
};
