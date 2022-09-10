import { string, object, array, InferType } from "yup";

export const discordMediumPayloadDetailsSchema = object({
  guildId: string().required(),
  channels: array(
    object({
      id: string().required(),
    })
  ),
  webhooks: array(
    object({
      id: string().required(),
      token: string().required(),
    })
  ),
  content: string(),
});

export type DiscordMediumPayloadDetails = InferType<
  typeof discordMediumPayloadDetailsSchema
>;
