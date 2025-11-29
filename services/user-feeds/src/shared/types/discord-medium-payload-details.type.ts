/* eslint-disable max-len */
import { z } from "zod";
import { CustomPlaceholderStepType, DiscordComponentType } from "../constants";

const buttonSchema = z.object({
  type: z.literal(DiscordComponentType.Button),
  style: z.number().min(1).max(5),
  label: z.string().max(80),
  emoji: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      animated: z.boolean().nullable(),
    })
    .optional()
    .nullable(),
  url: z.string().nullable(),
});

const actionRowSchema = z.object({
  type: z.literal(DiscordComponentType.ActionRow),
  components: z.array(buttonSchema),
});

// ============================================================================
// V2 Components Schema
// ============================================================================

const emojiSchemaV2 = z.object({
  id: z.string({ required_error: "Emoji ID is required" }),
  name: z.string().nullable(),
  animated: z.boolean().nullable(),
});

const textDisplaySchemaV2 = z.object({
  type: z.literal("TEXT_DISPLAY"),
  content: z
    .string({
      required_error: "Text display content is required",
      invalid_type_error: "Text display content must be a string",
    })
    .min(1, "Text display content cannot be empty"),
});

const thumbnailSchemaV2 = z.object({
  type: z.literal("THUMBNAIL"),
  media: z.object({
    url: z.string({
      required_error: "Thumbnail URL is required",
      invalid_type_error: "Thumbnail URL must be a string",
    }),
  }),
  description: z
    .string()
    .max(1024, "Thumbnail description cannot exceed 1024 characters")
    .optional()
    .nullable(),
  spoiler: z.boolean().optional().default(false),
});

const buttonSchemaV2 = z.object({
  type: z.literal("BUTTON"),
  style: z
    .number({
      required_error: "Button style is required",
      invalid_type_error: "Button style must be a number",
    })
    .min(1, "Button style must be between 1 and 6")
    .max(6, "Button style must be between 1 and 6"),
  label: z
    .string()
    .max(80, "Button label cannot exceed 80 characters")
    .optional(),
  emoji: emojiSchemaV2.optional().nullable(),
  url: z
    .string()
    .max(512, "Button URL cannot exceed 512 characters")
    .optional()
    .nullable(),
  disabled: z.boolean().optional().default(false),
});

const separatorSchemaV2 = z.object({
  type: z.literal("SEPARATOR"),
  divider: z.boolean().optional().default(true),
  spacing: z
    .number()
    .min(1, "Spacing must be 1 or 2")
    .max(2, "Spacing must be 1 or 2")
    .optional()
    .default(1),
});

const mediaGalleryItemSchemaV2 = z.object({
  media: z.object({
    url: z.string({
      required_error: "Media Gallery item URL is required",
      invalid_type_error: "Media Gallery item URL must be a string",
    }),
  }),
  description: z
    .string()
    .max(1024, "Media Gallery item description cannot exceed 1024 characters")
    .optional()
    .nullable(),
  spoiler: z.boolean().optional().default(false),
});

const mediaGallerySchemaV2 = z.object({
  type: z.literal("MEDIA_GALLERY"),
  items: z
    .array(mediaGalleryItemSchemaV2)
    .min(1, "Media Gallery must have at least 1 item")
    .max(10, "Media Gallery cannot have more than 10 items"),
});

const sectionSchemaV2 = z.object({
  type: z.literal("SECTION"),
  components: z
    .array(textDisplaySchemaV2)
    .min(1, "Section must have at least 1 component")
    .max(3, "Section cannot have more than 3 text displays"),
  accessory: z.discriminatedUnion("type", [buttonSchemaV2, thumbnailSchemaV2], {
    errorMap: () => ({ message: "Accessory must be a Button or Thumbnail" }),
  }),
});

const actionRowSchemaV2 = z.object({
  type: z.literal("ACTION_ROW"),
  components: z
    .array(buttonSchemaV2)
    .min(1, "Action row must have at least 1 button")
    .max(5, "Action row cannot have more than 5 buttons"),
});

// Container child components schema
const containerChildSchemaV2 = z.discriminatedUnion(
  "type",
  [
    separatorSchemaV2,
    actionRowSchemaV2,
    sectionSchemaV2,
    textDisplaySchemaV2,
    mediaGallerySchemaV2,
  ],
  {
    errorMap: () => ({
      message:
        "Container child must be a Separator, Action Row, Section, Text Display, or Media Gallery",
    }),
  }
);

const containerSchemaV2 = z.object({
  type: z.literal("CONTAINER"),
  accent_color: z
    .number()
    .min(0, "Accent color must be between 0x000000 and 0xFFFFFF")
    .max(0xffffff, "Accent color must be between 0x000000 and 0xFFFFFF")
    .optional()
    .nullable(),
  spoiler: z.boolean().optional().default(false),
  components: z
    .array(containerChildSchemaV2)
    .min(1, "Container must have at least 1 component"),
});

export const componentV2Schema = z.discriminatedUnion(
  "type",
  [sectionSchemaV2, actionRowSchemaV2, separatorSchemaV2, containerSchemaV2],
  {
    errorMap: () => ({
      message: "Component must be a Section, Action Row, or Separator",
    }),
  }
);

// ============================================================================
// Main Schema
// ============================================================================

export const discordMediumPayloadDetailsSchema = z.object({
  guildId: z.string(),
  components: z.array(actionRowSchema).nullable(),
  componentsV2: z.array(componentV2Schema).optional().nullable(),
  channel: z
    .object({
      id: z.string(),
      type: z
        .union([
          z.literal("forum"),
          z.literal("thread"),
          z.literal("new-thread"),
          z.literal("forum-thread"),
        ])
        .optional()
        .nullable(),
    })
    .optional()
    .nullable()
    .default(null),
  channelNewThreadTitle: z.string().optional().nullable(),
  channelNewThreadExcludesPreview: z
    .boolean()
    .optional()
    .nullable()
    .default(false),
  webhook: z
    .object({
      id: z.string(),
      token: z.string(),
      name: z.string().optional(),
      iconUrl: z.string().optional(),
      type: z
        .union([
          z.literal("forum"),
          z.literal("thread"),
          z.literal("forum-thread"),
        ])
        .optional()
        .nullable()
        .default(null),
      threadId: z.string().optional().nullable(),
    })
    .optional()
    .nullable()
    .default(null),
  forumThreadTitle: z.string().optional().nullable(),
  forumThreadTags: z
    .array(
      z.object({
        id: z.string(),
        filters: z
          .object({
            expression: z.object({}).passthrough(),
          })
          .optional()
          .nullable()
          .default(null),
      })
    )
    .optional()
    .nullable()
    .default(null),
  customPlaceholders: z
    .array(
      z.object({
        id: z.string(),
        referenceName: z.string(),
        sourcePlaceholder: z.string(),
        steps: z.array(
          z.union([
            z.object({
              type: z
                .literal(CustomPlaceholderStepType.Regex)
                .default(CustomPlaceholderStepType.Regex),
              regexSearch: z.string(),
              regexSearchFlags: z.string().optional().nullable(),
              replacementString: z.string().optional().nullable(),
            }),
            z.object({
              type: z.literal(CustomPlaceholderStepType.UrlEncode),
            }),
            z.object({
              type: z.literal(CustomPlaceholderStepType.DateFormat),
              format: z.string(),
              timezone: z.string().optional().nullable(),
              locale: z.string().optional().nullable(),
            }),
            z.object({
              type: z.literal(CustomPlaceholderStepType.Uppercase),
            }),
            z.object({
              type: z.literal(CustomPlaceholderStepType.Lowercase),
            }),
          ])
        ),
      })
    )
    .optional()
    .nullable()
    .default([]),
  mentions: z
    .object({
      targets: z
        .array(
          z.object({
            id: z.string(),
            type: z.union([z.literal("user"), z.literal("role")]),
            filters: z
              .object({
                expression: z.object({}).passthrough(),
              })
              .optional()
              .nullable()
              .default(null),
          })
        )
        .optional(),
    })
    .optional()
    .nullable()
    .default(null),
  content: z.string(),
  embeds: z.array(
    z.object({
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      color: z.number().optional(),
      footer: z
        .object({
          text: z.string(),
          iconUrl: z.string().optional().nullable().default(null),
        })
        .optional()
        .nullable()
        .default(null),
      image: z
        .object({
          url: z.string(),
        })
        .optional()
        .nullable()
        .default(null),
      thumbnail: z
        .object({
          url: z.string(),
        })
        .optional()
        .nullable()
        .default(null),
      author: z
        .object({
          name: z.string(),
          url: z.string().optional().nullable(),
          iconUrl: z.string().optional().nullable(),
        })
        .optional()
        .nullable()
        .default(null),
      fields: z
        .array(
          z.object({
            name: z.string(),
            value: z.string(),
            inline: z.boolean().optional(),
          })
        )
        .optional(),
      timestamp: z
        .union([z.literal("now"), z.literal("article"), z.literal("")])
        .optional()
        .nullable()
        .default(null),
    })
  ),
  formatter: z
    .object({
      stripImages: z.boolean().optional().default(false),
      formatTables: z.boolean().optional().default(false),
      disableImageLinkPreviews: z.boolean().optional().default(false),
      ignoreNewLines: z.boolean().optional().default(true),
    })
    .optional()
    .default({}),
  splitOptions: z
    .object({
      splitChar: z.string().optional().nullable(),
      appendChar: z.string().optional().nullable(),
      prependChar: z.string().optional().nullable(),
    })
    .optional(),
  placeholderLimits: z
    .array(
      z.object({
        placeholder: z.string(),
        characterCount: z.number(),
        appendString: z.string().optional().nullable().default(null),
      })
    )
    .optional()
    .nullable()
    .default(null),
  enablePlaceholderFallback: z.boolean().optional().default(false),
});

export type DiscordMediumPayloadDetails = z.infer<
  typeof discordMediumPayloadDetailsSchema
>;

// V2 Component Types (inferred from Zod schemas)
export type ButtonV2 = z.infer<typeof buttonSchemaV2>;
export type TextDisplayV2 = z.infer<typeof textDisplaySchemaV2>;
export type SectionV2 = z.infer<typeof sectionSchemaV2>;
export type ActionRowV2 = z.infer<typeof actionRowSchemaV2>;
export type SeparatorV2 = z.infer<typeof separatorSchemaV2>;
export type MediaGalleryV2 = z.infer<typeof mediaGallerySchemaV2>;
export type MediaGalleryItemV2 = z.infer<typeof mediaGalleryItemSchemaV2>;
export type ContainerV2 = z.infer<typeof containerSchemaV2>;
export type ComponentV2 = z.infer<typeof componentV2Schema>;
