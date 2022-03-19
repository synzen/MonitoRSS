import { InferType, object, string } from 'yup';

export const DiscordWebhookSchema = object({
  id: string().required(),
  channelId: string().required(),
  avatarUrl: string().optional(),
  name: string().required(),
});

export type DiscordWebhook = InferType<typeof DiscordWebhookSchema>;
