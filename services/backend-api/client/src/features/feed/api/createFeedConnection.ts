import { object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnectionType } from '../constants';
import { FeedConnection, FeedConnectionSchema } from '../types';

export interface CreateDiscordChannelFeedConnectionInput {
  feedId: string;
  details: {
    type: FeedConnectionType.DiscordChannel
    channelId: string;
  }
}

export interface CreateDiscordWebhookFeedConnectionInput {
  feedId: string;
  details: {
    type: FeedConnectionType.DiscordWebhook
    webhookId: string;
    name?: string
    iconUrl?: string
  }
}

export type CreateFeedConnectionInput = CreateDiscordChannelFeedConnectionInput
| CreateDiscordWebhookFeedConnectionInput;

const CreateFeedConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type CreateFeedConnectionOutput = {
  result: FeedConnection
};

export const createFeedConnection = async (
  options: CreateFeedConnectionInput,
): Promise<CreateFeedConnectionOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/connections`,
  {
    validateSchema: CreateFeedConnectionOutputSchema,
    requestOptions: {
      method: 'POST',
      body: JSON.stringify(options.details),
    },
  },
);
