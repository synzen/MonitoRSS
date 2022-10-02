import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnectionSchema } from '../types';

export interface UpdateDiscordChannelConnectionInput {
  feedId: string;
  connectionId: string
  details: {
    channelId?: string
    content?: string | null;
    filters?: Record<string, any> | null
    embeds?: Array<{
      color?: number
      authorTitle?: string | null
      authorUrl?: string | null
      authorIconUrl?: string | null
      title?: string | null
      url?: string | null
      description?: string | null
      thumbnailUrl?: string | null
      imageUrl?: string | null
      footerText?: string | null
      footerIconUrl?: string | null
    }>
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
