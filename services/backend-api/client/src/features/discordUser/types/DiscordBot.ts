import { InferType, object, string } from "yup";

export const DiscordBotSchema = object({
  id: string().required(),
  username: string().required(),
  avatar: string().nullable(),
});

export type DiscordBot = InferType<typeof DiscordBotSchema>;
