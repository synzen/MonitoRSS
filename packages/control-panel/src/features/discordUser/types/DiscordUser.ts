import { InferType, object, string } from 'yup';

export const DiscordUserSchema = object({
  id: string().required(),
  username: string().required(),
  iconUrl: string().optional(),
}).required();

export type DiscordUser = InferType<typeof DiscordUserSchema>;
