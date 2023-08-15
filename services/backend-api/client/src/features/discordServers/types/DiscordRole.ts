import { InferType, object, string } from "yup";

export const DiscordRoleSchema = object({
  id: string().required(),
  name: string().typeError("Must be a string").strict(true),
  color: string().required(),
});

export type DiscordRole = InferType<typeof DiscordRoleSchema>;
