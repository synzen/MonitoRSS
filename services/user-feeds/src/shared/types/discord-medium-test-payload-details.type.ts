import { z } from "zod";
import { discordMediumPayloadDetailsSchema } from "./discord-medium-payload-details.type";

export const discordMediumTestPayloadDetailsSchema =
  discordMediumPayloadDetailsSchema.extend({
    guildId: z.string().optional(),
  });

export type DiscordMediumTestPayloadDetails = z.infer<
  typeof discordMediumTestPayloadDetailsSchema
>;
