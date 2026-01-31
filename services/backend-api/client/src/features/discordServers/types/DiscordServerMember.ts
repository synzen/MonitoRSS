import { InferType, object, string } from "yup";

export const DiscordServerMemberSchema = object({
  id: string().required(),
  username: string().required(),
  displayName: string().required(),
  avatarUrl: string().nullable(),
});

export type DiscordServerMember = InferType<typeof DiscordServerMemberSchema>;
