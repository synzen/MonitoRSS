import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnectionSchema } from '@/types';

export interface UpdateDiscordWebhookConnectionInput {
  feedId: string;
  connectionId: string
  details: {
    name?: string
    webhook?: {
      id?: string
      name?: string
      iconUrl?: string
    }
    content?: string | null
    filters?: Record<string, any> | null
    embeds?: Array<{
      color?: number
      author?: {
        name?: string
        url?: string
        iconUrl?: string
      }
      thumbnail?: {
        url?: string
      }
      image?: {
        url?: string
      }
      footer?: {
        text?: string
        iconUrl?: string
      }
      title?: string | null
      url?: string | null
      description?: string | null
    }>
  }
}

const UpdateDiscordWebhookConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type UpdateDiscordWebhookConnectionOutput = InferType<
  typeof UpdateDiscordWebhookConnectionOutputSchema
>;

export const updateDiscordWebhookConnection = async (
  options: UpdateDiscordWebhookConnectionInput,
): Promise<UpdateDiscordWebhookConnectionOutput> => {
  const res = await fetchRest(
    `/api/v1/feeds/${options.feedId}/connections/discord-webhooks/${options.connectionId}`,
    {
      validateSchema: UpdateDiscordWebhookConnectionOutputSchema,
      requestOptions: {
        method: 'PUT',
        body: JSON.stringify(options.details),
      },
    },
  );

  return res as UpdateDiscordWebhookConnectionOutput;
};
