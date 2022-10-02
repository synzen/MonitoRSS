import {
  array, InferType, object, string,
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

const DiscordWebhookConnectionDetailsSchema = object({
  embeds: array(FeedEmbedSchema).required(),
  webhook: object({
    id: string().required(),
    name: string().optional(),
    iconUrl: string().optional(),
  }).required(),
  content: string().optional(),
});

export const FeedConnectionSchema = object({
  id: string().required(),
  key: string().oneOf(Object.values(FeedConnectionType)).required(),
  filters: object({
    expression: object(),
  }).optional().default(undefined).nullable(),
  details: object().when('key', ([key]) => {
    if (key === FeedConnectionType.DiscordWebhook) {
      return DiscordWebhookConnectionDetailsSchema;
    }

    return DiscordChannelConnectionDetailsSchema;
  }),
});

export interface FeedDiscordChannelConnection {
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

export interface FeedDiscordWebhookConnection {
  id: string
  key: FeedConnectionType.DiscordWebhook
  filters?: {
    expression: Record<string, never>
  }
  details: {
    content: string;
    embeds: Feed['embeds']
    webhook: {
      id: string
      name?: string
      iconUrl?: string
    }
  }
}

export type FeedConnection = InferType<typeof FeedConnectionSchema>;
