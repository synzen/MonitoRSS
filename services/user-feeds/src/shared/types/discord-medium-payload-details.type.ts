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
      type: string()
        .optional()
        .oneOf(["forum", "thread"])
        .default(undefined)
        .nullable(),
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
    forumThreadTitle: string().nullable().default(undefined),
    forumThreadTags: array(
      object({
        id: string().required(),
        filters: object({
          expression: object(),
        })
          .optional()
          .nullable()
          .default(null),
      }).required()
    )
      .nullable()
      .default(undefined),
    mentions: object({
      targets: array(
        object({
          id: string().required(),
          type: string().required().oneOf(["user", "role"]),
          filters: object({
            expression: object(),
          })
            .optional()
            .nullable()
            .default(null),
        }).required()
      ),
    })
      .nullable()
      .default(undefined),
    content: string(),
    embeds: array(
      object({
        title: string().optional(),
        description: string().optional(),
        url: string().optional(),
        color: number().optional(),
        footer: object({
          text: string().required(),
          iconUrl: string().optional().nullable().default(undefined),
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
        timestamp: string()
          .oneOf(["now", "article", ""])
          .optional()
          .nullable()
          .default(undefined),
      }).required()
    ),
    formatter: object({
      stripImages: boolean().optional().default(false),
      formatTables: boolean().optional().default(false),
      disableImageLinkPreviews: boolean().optional().default(false),
    }).required(),
    splitOptions: object({
      splitChar: string().optional().nullable(),
      appendChar: string().optional().nullable(),
      prependChar: string().optional().nullable(),
    })
      .optional()
      .default(undefined),
    placeholderLimits: array(
      object({
        placeholder: string().required(),
        characterCount: number().required(),
        appendString: string().optional().nullable().default(undefined),
      }).required()
    )
      .optional()
      .nullable()
      .default(undefined),
    enablePlaceholderFallback: boolean().optional().default(false),
  },
  [["channel", "webhook"]]
);

export type DiscordMediumPayloadDetails = InferType<
  typeof discordMediumPayloadDetailsSchema
>;
