import { z } from "zod";
import {
  CustomPlaceholderStepType,
  DiscordComponentType,
  MediumKey,
} from "../constants";

// ============================================================================
// Shared Schemas
// ============================================================================

const mediumKeySchema = z.enum(MediumKey);

const mediumFiltersSchema = z.object({
  expression: z.looseObject({}),
});

const mediumRateLimitSchema = z.object({
  timeWindowSeconds: z.number(),
  limit: z.number(),
});

const externalFeedPropertySchema = z.object({
  sourceField: z.string(),
  label: z.string(),
  cssSelector: z.string(),
});

// ============================================================================
// Discord Component Schemas
// ============================================================================

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

// V2 Components
const emojiSchemaV2 = z.object({
  id: z.string(),
  name: z.string().nullable(),
  animated: z.boolean().nullable(),
});

const textDisplaySchemaV2 = z.object({
  type: z.literal("TEXT_DISPLAY"),
  content: z.string().min(1),
});

const thumbnailSchemaV2 = z.object({
  type: z.literal("THUMBNAIL"),
  media: z.object({ url: z.string() }),
  description: z.string().max(1024).optional().nullable(),
  spoiler: z.boolean().optional().default(false),
});

const buttonSchemaV2 = z.object({
  type: z.literal("BUTTON"),
  style: z.number().min(1).max(6),
  label: z.string().max(80).optional(),
  emoji: emojiSchemaV2.optional().nullable(),
  url: z.string().max(512).optional().nullable(),
  disabled: z.boolean().optional().default(false),
});

const separatorSchemaV2 = z.object({
  type: z.literal("SEPARATOR"),
  divider: z.boolean().optional().default(true),
  spacing: z.number().min(1).max(2).optional().default(1),
});

const mediaGalleryItemSchemaV2 = z.object({
  media: z.object({ url: z.string() }),
  description: z.string().max(1024).optional().nullable(),
  spoiler: z.boolean().optional().default(false),
});

const mediaGallerySchemaV2 = z.object({
  type: z.literal("MEDIA_GALLERY"),
  items: z.array(mediaGalleryItemSchemaV2).min(1).max(10),
});

const sectionSchemaV2 = z.object({
  type: z.literal("SECTION"),
  components: z.array(textDisplaySchemaV2).min(1).max(3),
  accessory: z.discriminatedUnion("type", [buttonSchemaV2, thumbnailSchemaV2]),
});

const actionRowSchemaV2 = z.object({
  type: z.literal("ACTION_ROW"),
  components: z.array(buttonSchemaV2).min(1).max(5),
});

const containerChildSchemaV2 = z.discriminatedUnion("type", [
  separatorSchemaV2,
  actionRowSchemaV2,
  sectionSchemaV2,
  textDisplaySchemaV2,
  mediaGallerySchemaV2,
]);

const containerSchemaV2 = z.object({
  type: z.literal("CONTAINER"),
  accent_color: z.number().min(0).max(0xffffff).optional().nullable(),
  spoiler: z.boolean().optional().default(false),
  components: z.array(containerChildSchemaV2).min(1),
});

const componentV2Schema = z.discriminatedUnion("type", [
  sectionSchemaV2,
  actionRowSchemaV2,
  separatorSchemaV2,
  containerSchemaV2,
]);

// ============================================================================
// Discord Medium Payload Details Schema
// ============================================================================

const discordMediumPayloadDetailsSchema = z.object({
  guildId: z.string(),
  components: z.array(actionRowSchema).nullable(),
  componentsV2: z.array(componentV2Schema).min(1).optional().nullable(),
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
          .object({ expression: z.looseObject({}) })
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
            z.object({ type: z.literal(CustomPlaceholderStepType.UrlEncode) }),
            z.object({
              type: z.literal(CustomPlaceholderStepType.DateFormat),
              format: z.string(),
              timezone: z.string().optional().nullable(),
              locale: z.string().optional().nullable(),
            }),
            z.object({ type: z.literal(CustomPlaceholderStepType.Uppercase) }),
            z.object({ type: z.literal(CustomPlaceholderStepType.Lowercase) }),
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
              .object({ expression: z.object({}).passthrough() })
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
      color: z.number().optional().nullable(),
      footer: z
        .object({
          text: z.string(),
          iconUrl: z.string().optional().nullable().default(null),
        })
        .optional()
        .nullable()
        .default(null),
      image: z.object({ url: z.string() }).optional().nullable().default(null),
      thumbnail: z
        .object({ url: z.string() })
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
    .optional(),
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

// ============================================================================
// Medium Payload Schema
// ============================================================================

const baseMediumPayloadSchema = z.object({
  key: mediumKeySchema,
  details: z.looseObject({}),
});

const mediumPayloadSchema = baseMediumPayloadSchema.extend({
  id: z.string(),
  key: mediumKeySchema,
  filters: mediumFiltersSchema.optional().nullable(),
  rateLimits: z.array(mediumRateLimitSchema).optional().nullable(),
  details: discordMediumPayloadDetailsSchema,
});

// ============================================================================
// Feed V2 Event Schema
// ============================================================================

const feedV2EventSchemaFormatOptions = z.object({
  dateFormat: z.string().optional(),
  dateTimezone: z.string().optional(),
  dateLocale: z.string().optional(),
});

const feedV2EventSchemaDateChecks = z.object({
  oldArticleDateDiffMsThreshold: z.number().optional(),
  datePlaceholderReferences: z.array(z.string()).optional(),
});

const feedV2EventRequestLookupDetails = z.object({
  key: z.string(),
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

// Test endpoint schema variant (guildId is optional for test)
const discordMediumTestPayloadDetailsSchema =
  discordMediumPayloadDetailsSchema.extend({
    guildId: z.string().optional(),
  });

// Export individual schemas for API use
export { discordMediumPayloadDetailsSchema };
export { discordMediumTestPayloadDetailsSchema };
export { feedV2EventSchemaFormatOptions };
export { feedV2EventSchemaDateChecks };
export { feedV2EventRequestLookupDetails };
export { externalFeedPropertySchema };
export { componentV2Schema };

export const feedV2EventSchema = z.object({
  timestamp: z.number().optional(),
  debug: z.boolean().optional(),
  data: z.object({
    feed: z.object({
      id: z.string(),
      url: z.string(),
      passingComparisons: z.array(z.string()),
      blockingComparisons: z.array(z.string()),
      formatOptions: feedV2EventSchemaFormatOptions.optional(),
      dateChecks: feedV2EventSchemaDateChecks.optional(),
      externalProperties: z.array(externalFeedPropertySchema).optional(),
      requestLookupDetails: feedV2EventRequestLookupDetails
        .optional()
        .nullable(),
    }),
    mediums: z.array(mediumPayloadSchema).min(1),
    articleDayLimit: z.number(),
  }),
});

export type FeedV2Event = z.infer<typeof feedV2EventSchema>;
