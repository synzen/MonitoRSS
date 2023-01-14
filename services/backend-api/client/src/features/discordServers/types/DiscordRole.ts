import { InferType, object, string } from "yup";

export const DiscordRoleSchema = object({
  id: string().required(),
  name: string().required(),
  color: string().required(),
});

export type DiscordRole = InferType<typeof DiscordRoleSchema>;
