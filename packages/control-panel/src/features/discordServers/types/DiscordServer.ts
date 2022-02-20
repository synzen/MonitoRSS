import { InferType, object, string } from 'yup';

export const DiscordServerSchema = object({
  id: string().required(),
  name: string().required(),
  icon: string().optional(),
}).required();

export type DiscordServer = InferType<typeof DiscordServerSchema>;
