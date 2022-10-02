import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnectionSchema } from '../types';

export interface UpdateDiscordChannelConnectionInput {
  feedId: string;
  connectionId: string
  details: {
    content?: string | null;
    filters?: Record<string, any> | null
  }
}

const UpdateDiscordChannelConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type UpdateDiscordChannelConnectionOutput = InferType<
  typeof UpdateDiscordChannelConnectionOutputSchema
>;

export const updateDiscordChannelConnection = async (
  options: UpdateDiscordChannelConnectionInput,
): Promise<UpdateDiscordChannelConnectionOutput> => {
  const res = await fetchRest(
    `/api/v1/feeds/${options.feedId}/connections/discord-channels/${options.connectionId}`,
    {
      validateSchema: UpdateDiscordChannelConnectionOutputSchema,
      requestOptions: {
        method: 'PUT',
        body: JSON.stringify(options.details),
      },
    },
  );

  return res as UpdateDiscordChannelConnectionOutput;
};
