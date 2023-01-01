import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnectionDisabledCode, FeedConnectionSchema } from '@/types';

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
    disabledCode?: FeedConnectionDisabledCode.Manual | null
    filters?: {
      expression: Record<string, any>
    } | null
    embeds?: Array<{
      color?: string
      author?: {
        name?: string
        url?: string
        iconUrl?: string
      } | null
      thumbnail?: {
        url?: string
      } | null
      image?: {
        url?: string
      } | null
      footer?: {
        text?: string
        iconUrl?: string
      } | null
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
    `/api/v1/user-feeds/${options.feedId}/connections/discord-webhooks/${options.connectionId}`,
    {
      validateSchema: UpdateDiscordWebhookConnectionOutputSchema,
      requestOptions: {
        method: 'PATCH',
        body: JSON.stringify(options.details),
      },
    },
  );

  return res as UpdateDiscordWebhookConnectionOutput;
};
