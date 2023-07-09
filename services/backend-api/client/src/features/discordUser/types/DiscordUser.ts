import { InferType, object, string } from "yup";

export const DiscordUserSchema = object({
  id: string().required(),
  username: string().required(),
  avatarUrl: string().optional().nullable(),
});

export type DiscordUser = InferType<typeof DiscordUserSchema>;
