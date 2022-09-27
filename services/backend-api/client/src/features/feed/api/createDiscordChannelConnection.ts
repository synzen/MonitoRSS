import { object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnection, FeedConnectionSchema } from '../types';

export interface CreateDiscordChannelConnectionInput {
  feedId: string;
  details: {
    channelId: string;
  }
}

const CreateFeedConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type CreateDiscordChannelConnectionOutput = {
  result: FeedConnection
};

export const createDiscordChannelConnection = async (
  options: CreateDiscordChannelConnectionInput,
): Promise<CreateDiscordChannelConnectionOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/connections/discord-channels`,
  {
    validateSchema: CreateFeedConnectionOutputSchema,
    requestOptions: {
      method: 'POST',
      body: JSON.stringify(options.details),
    },
  },
);
