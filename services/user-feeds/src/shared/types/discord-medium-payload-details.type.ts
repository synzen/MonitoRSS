/* eslint-disable max-len */
import { z } from "zod";
import { CustomPlaceholderStepType } from "../constants";

const buttonSchema = z.object({
  type: z.number().min(2).max(2),
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
  type: z.literal(1),
  components: z.array(buttonSchema),
});

export const discordMediumPayloadDetailsSchema = z.object({
  guildId: z.string(),
  components: z.array(actionRowSchema).nullable(),
  channel: z
    .object({
      id: z.string(),
      type: z
        .union([
          z.literal("forum"),
          z.literal("thread"),
          z.literal("new-thread"),
        ])
        .optional()
        .nullable(),
    })
    .optional()
    .nullable()
    .default(null),
  channelNewThreadTitle: z.string().optional().nullable(),
  channelNewThreadWithPost: z.boolean().optional().nullable().default(false),
  webhook: z
    .object({
      id: z.string(),
      token: z.string(),
      name: z.string().optional(),
      iconUrl: z.string().optional(),
      type: z
        .union([z.literal("forum"), z.literal("thread")])
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
  formatter: z.object({
    stripImages: z.boolean().optional().default(false),
    formatTables: z.boolean().optional().default(false),
    disableImageLinkPreviews: z.boolean().optional().default(false),
    ignoreNewLines: z.boolean().optional().default(true),
  }),
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
