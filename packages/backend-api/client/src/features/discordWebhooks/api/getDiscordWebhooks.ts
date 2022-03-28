import {
  array, InferType, object,
} from 'yup';
import qs from 'qs';
import fetchRest from '../../../utils/fetchRest';
import { DiscordWebhookSchema } from '../types';

export interface GetDiscordWebhooksInput {
  serverId: string
}

const GetDiscordWebhooksOutputSchema = object({
  results: array(DiscordWebhookSchema).required(),
});

export type GetDiscordWebhooksOutput = InferType<typeof GetDiscordWebhooksOutputSchema>;

export const getDiscordWebhooks = async (options: GetDiscordWebhooksInput): Promise<
GetDiscordWebhooksOutput
> => {
  const query = qs.stringify({
    filters: {
      serverId: options.serverId,
    },
  });

  return fetchRest(`/api/v1/discord-webhooks?${query}`, {
    validateSchema: GetDiscordWebhooksOutputSchema,
  });
};
