import { string, object, InferType } from "yup";

export const discordMediumPayloadDetailsSchema = object({
  guildId: string().required(),
  channel: object({
    id: string().required(),
  }).optional(),
  webhook: object({
    id: string().required(),
    token: string().required(),
  }).optional(),
  content: string(),
});

export type DiscordMediumPayloadDetails = InferType<
  typeof discordMediumPayloadDetailsSchema
>;
