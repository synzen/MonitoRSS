import { string, object, InferType, array, number, boolean } from "yup";

/**
 * .default(undefined) is NECESSARY when using .optional(), otherwise optional objects with
 * required fields will throw, saying the nested field is required
 */
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
        })
          .optional()
          .default(undefined),
        image: object({
          url: string().required(),
        })
          .optional()
          .default(undefined),
        thumbnail: object({
          url: string().required(),
        })
          .optional()
          .default(undefined),
        author: object({
          name: string().required(),
          url: string().optional(),
          iconUrl: string().optional(),
        })
          .optional()
          .default(undefined),
        fields: array(
          object({
            name: string().required(),
            value: string().required(),
            inline: boolean().optional(),
          }).required()
        ).optional(),
      }).required()
    ),
    formatter: object({
      stripImages: boolean().optional().default(false),
      formatTables: boolean().optional().default(false),
    }).required(),
  },
  [["channel", "webhook"]]
);

export type DiscordMediumPayloadDetails = InferType<
  typeof discordMediumPayloadDetailsSchema
>;
