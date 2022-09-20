import { string, object, InferType, array, number, boolean } from "yup";

export const discordMediumPayloadDetailsSchema = object({
  guildId: string().required(),
  channel: object({
    id: string().required(),
  })
    .optional()
    .nullable()
    .default(null),
  webhook: object({
    id: string().required(),
    token: string().required(),
  })
    .optional()
    .nullable()
    .default(null),
  content: string(),
  embeds: array(
    object({
      title: string().optional(),
      description: string().optional(),
      url: string().optional(),
      color: number().optional(),
      footer: object({
        text: string().required(),
        iconUrl: string().optional(),
      }).optional(),
      image: object({
        url: string().required(),
      }).optional(),
      thumbnail: object({
        url: string().required(),
      }).optional(),
      author: object({
        name: string().required(),
        url: string().optional(),
        iconUrl: string().optional(),
      }).optional(),
      fields: array(
        object({
          name: string().required(),
          value: string().required(),
          inline: boolean().optional(),
        }).required()
      ).optional(),
    }).required()
  ),
});

export type DiscordMediumPayloadDetails = InferType<
  typeof discordMediumPayloadDetailsSchema
>;
