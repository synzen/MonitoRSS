import {
  array, object, string,
} from 'yup';
import { FeedConnectionType } from '../../feed/constants';
import { Feed, FeedEmbedSchema } from '../../feed/types/Feed';

const DiscordChannelConnectionDetailsSchema = object({
  embeds: array(FeedEmbedSchema).required(),
  channel: object({
    id: string().required(),
  }).required(),
  content: string().optional(),
});

export const FeedConnectionSchema = object({
  id: string().required(),
  key: string().oneOf(Object.values(FeedConnectionType)).required(),
  filters: object({
    expression: object(),
  }).optional().default(undefined),
  details: object().when('key', {
    is: FeedConnectionType.DiscordChannel,
    then: DiscordChannelConnectionDetailsSchema,
    otherwise: object().oneOf([null]),
  }),
});

interface FeedDiscordChannelConnection {
  id: string
  key: FeedConnectionType.DiscordChannel
  filters?: {
    expression: Record<string, never>
  }
  details: {
    embeds: Feed['embeds']
    channel: {
      id: string
    }
    content?: string;
  }
}

interface FeedDiscordWebhookConnection {
  id: string
  key: FeedConnectionType.DiscordWebhook
  filters?: {
    expression: Record<string, never>
  }
  details: {
    embeds: Feed['embeds']
    webhook: {
      id: string
      name?: string
      iconUrl?: string
    }
  }
}

export type FeedConnection = FeedDiscordChannelConnection | FeedDiscordWebhookConnection;
