import { bool, InferType, number, object, string } from "yup";

export const DiscordServerSchema = object({
  id: string().required(),
  name: string().required(),
  iconUrl: string().optional(),
  benefits: object({
    maxFeeds: number().required(),
    webhooks: bool().required(),
  }),
}).required();

export type DiscordServer = InferType<typeof DiscordServerSchema>;
