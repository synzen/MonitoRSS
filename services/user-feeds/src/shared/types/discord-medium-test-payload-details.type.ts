import { string, InferType } from "yup";
import { discordMediumPayloadDetailsSchema } from "./discord-medium-payload-details.type";

export const discordMediumTestPayloadDetailsSchema =
  discordMediumPayloadDetailsSchema.shape({
    guildId: string().optional(),
  });

export type DiscordMediumTestPayloadDetails = InferType<
  typeof discordMediumTestPayloadDetailsSchema
>;
