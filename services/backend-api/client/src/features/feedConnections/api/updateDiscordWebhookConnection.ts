import { object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnection, FeedConnectionSchema } from '../types';

export interface UpdateDiscordWebhookConnectionInput {
  feedId: string;
  connectionId: string
  details: {
    content?: string | null
    filters?: Record<string, any> | null
  }
}

const UpdateDiscordWebhookConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type UpdateDiscordWebhookConnectionOutput = {
  result: FeedConnection
};

export const updateDiscordWebhookConnection = async (
  options: UpdateDiscordWebhookConnectionInput,
): Promise<UpdateDiscordWebhookConnectionOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/connections/discord-webhooks/${options.connectionId}`,
  {
    validateSchema: UpdateDiscordWebhookConnectionOutputSchema,
    requestOptions: {
      method: 'PUT',
      body: JSON.stringify(options.details),
    },
  },
);
