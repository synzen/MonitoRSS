import {
  bool, InferType, object, string,
} from 'yup';

export const DiscordServerSchema = object({
  id: string().required(),
  name: string().required(),
  iconUrl: string().optional(),
  isWebhooksEnabled: bool().required(),
}).required();

export type DiscordServer = InferType<typeof DiscordServerSchema>;
