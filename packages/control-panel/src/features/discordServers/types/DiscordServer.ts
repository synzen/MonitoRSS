import { InferType, object, string } from 'yup';

export const DiscordServerSchema = object({
  id: string(),
  name: string(),
  icon: string().optional(),
});

export type DiscordServer = InferType<typeof DiscordServerSchema>;
