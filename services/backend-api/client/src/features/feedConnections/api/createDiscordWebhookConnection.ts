import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnectionSchema } from '@/types';

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

export type CreateDiscordWebhookConnectionOutput = InferType<
  typeof CreateFeedConnectionOutputSchema
>;

export const createDiscordWebhookConnection = async (
  options: CreateDiscordWebhookConnectionInput,
): Promise<CreateDiscordWebhookConnectionOutput> => {
  const res = await fetchRest(
    `/api/v1/feeds/${options.feedId}/connections/discord-webhooks`,
    {
      validateSchema: CreateFeedConnectionOutputSchema,
      requestOptions: {
        method: 'POST',
        body: JSON.stringify(options.details),
      },
    },
  );

  return res as CreateDiscordWebhookConnectionOutput;
};
