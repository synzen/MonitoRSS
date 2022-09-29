import { object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnection, FeedConnectionSchema } from '../types';

export interface UpdateDiscordChannelConnectionInput {
  feedId: string;
  connectionId: string
  details: {
    content?: string;
    filters?: Record<string, any>
  }
}

const UpdateDiscordChannelConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type UpdateDiscordChannelConnectionOutput = {
  result: FeedConnection
};

export const updateDiscordChannelConnection = async (
  options: UpdateDiscordChannelConnectionInput,
): Promise<UpdateDiscordChannelConnectionOutput> => fetchRest(
  `/api/v1/feeds/${options.feedId}/connections/discord-channels/${options.connectionId}`,
  {
    validateSchema: UpdateDiscordChannelConnectionOutputSchema,
    requestOptions: {
      method: 'PUT',
      body: JSON.stringify(options.details),
    },
  },
);
