import { string, object, InferType, array, number, boolean } from "yup";

export const discordMediumPayloadDetailsSchema = object().shape(
  {
    guildId: string().required(),
    channel: object({
      id: string().required(),
    })
      .nullable()
      .default(null)
      .when("webhook", {
        is: (val: unknown) => val === null,
        then: (schema) => schema.required(),
        otherwise: (schema) => schema.optional(),
      }),
    webhook: object({
      id: string().required(),
      token: string().required(),
      name: string().optional(),
      iconUrl: string().optional(),
    })
      .nullable()
      .default(null)
      .when("channel", {
        is: (val: unknown) => val === null,
        then: (schema) => schema.required(),
        otherwise: (schema) => schema.optional(),
      }),
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
    ).default([]),
  },
  [["channel", "webhook"]]
);

export type DiscordMediumPayloadDetails = InferType<
  typeof discordMediumPayloadDetailsSchema
>;
