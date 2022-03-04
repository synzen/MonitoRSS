import {
  array, InferType, object,
} from 'yup';
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
> => fetchRest(`/api/v1/discord-servers/${options.serverId}/webhooks`, {
  validateSchema: GetDiscordWebhooksOutputSchema,
});
