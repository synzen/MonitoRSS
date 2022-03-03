import {
  array, InferType, object,
} from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { DiscordWebhookSchema } from '../types';

export interface GetDiscordServerWebhooksInput {
  serverId: string
}

const GetDiscordServerWebhooksOutputSchema = object({
  results: array(DiscordWebhookSchema).required(),
});

export type GetDiscordServerWebhooksOutput = InferType<typeof GetDiscordServerWebhooksOutputSchema>;

export const getDiscordServerWebhooks = async (options: GetDiscordServerWebhooksInput): Promise<
GetDiscordServerWebhooksOutput
> => fetchRest(`/api/v1/discord-servers/${options.serverId}/webhooks`, {
  validateSchema: GetDiscordServerWebhooksOutputSchema,
});
