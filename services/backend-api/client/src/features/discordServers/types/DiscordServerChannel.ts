import { InferType, object, string } from "yup";

export const DiscordServerChannelSchema = object({
  id: string().required(),
  name: string().required(),
});

export type DiscordServerChannel = InferType<typeof DiscordServerChannelSchema>;
