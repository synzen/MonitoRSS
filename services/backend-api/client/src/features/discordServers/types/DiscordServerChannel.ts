import { InferType, object, string } from "yup";

export const DiscordServerChannelSchema = object({
  id: string().required(),
  name: string().required(),
  type: string().optional().oneOf(["text", "forum", "announcement"]).nullable(),
  category: object({
    name: string().required(),
  })
    .nullable()
    .default(null),
});

export type DiscordServerChannel = InferType<typeof DiscordServerChannelSchema>;
