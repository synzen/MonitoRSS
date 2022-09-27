import { object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnection, FeedConnectionSchema } from '../types';

export interface CreateDiscordWebhookConnectionInput {
  feedId: string;
  details: {
    webhookId: string;
    name?: string
    iconUrl?: string
  }
}

const CreateFeedConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type CreateDiscordWebhookConnectionOutput = {
  result: FeedConnection
};

export const createDiscordWebhookConnection = async (
  options: CreateDiscordWebhookConnectionInput,
): Promise<CreateDiscordWebhookConnectionOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/connections/discord-webhook`,
  {
    validateSchema: CreateFeedConnectionOutputSchema,
    requestOptions: {
      method: 'POST',
      body: JSON.stringify(options.details),
    },
  },
);
