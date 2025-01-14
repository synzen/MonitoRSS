import { InferType, object, string } from "yup";

export const DiscordBotSchema = object({
  id: string().required(),
  username: string().required(),
  avatar: string().nullable(),
  inviteLink: string().required(),
});

export type DiscordBot = InferType<typeof DiscordBotSchema>;
