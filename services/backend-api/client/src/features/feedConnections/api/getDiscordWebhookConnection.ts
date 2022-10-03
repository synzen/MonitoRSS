import { object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { FeedConnectionSchema, FeedDiscordWebhookConnection } from '@/types';

export interface GetDiscordWebhookConnectionInput {
  feedId: string;
  connectionId: string
}

const GetFeedConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type GetDiscordWebhookConnectionOutput = {
  result: FeedDiscordWebhookConnection
};

export const getDiscordWebhookConnection = async (
  options: GetDiscordWebhookConnectionInput,
): Promise<GetDiscordWebhookConnectionOutput> => {
  const res = await fetchRest(
    `/api/v1/feeds/${options.feedId}/connections/discord-webhooks/${options.connectionId}`,
    {
      validateSchema: GetFeedConnectionOutputSchema,
    },
  );

  return res as GetDiscordWebhookConnectionOutput;
};
