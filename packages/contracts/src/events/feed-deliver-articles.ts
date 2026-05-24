import { z } from "zod";

/**
 * Published by: backend-api (when articles are ready to deliver to Discord)
 * Consumed by: user-feeds-next (article pipeline)
 *
 * This is the highest-traffic event in the system and the one most likely to
 * carry contract drift if changed unilaterally.
 *
 * Discord-specific nested shapes (embeds, components, customPlaceholders) are
 * intentionally typed as `z.record(z.string(), z.unknown())` rather than strict Zod —
 * those payloads are large freeform Discord API surface that would couple this
 * schema tightly to Discord's evolution. The discipline is: keep the OUTER
 * structure strict; let the Discord-shaped INNER details remain freeform until
 * the Bundle C multi-platform work forces them into a typed abstraction.
 */

const DiscordMediumEventDetailsSchema = z.object({
  channelNewThreadTitle: z.string().optional(),
  channelNewThreadExcludesPreview: z.boolean().optional(),
  guildId: z.string(),
  channel: z
    .object({
      id: z.string(),
      type: z.string().nullable().optional(),
      guildId: z.string(),
    })
    .optional(),
  webhook: z
    .object({
      id: z.string(),
      token: z.string(),
      name: z.string().optional(),
      iconUrl: z.string().optional(),
      type: z.string().nullable().optional(),
      threadId: z.string().optional(),
    })
    .optional(),
  content: z.string(),
  embeds: z.array(z.record(z.string(), z.unknown())),
  components: z.array(z.record(z.string(), z.unknown())),
  componentsV2: z.array(z.record(z.string(), z.unknown())).optional(),
  forumThreadTitle: z.string().optional(),
  forumThreadTags: z
    .array(
      z.object({
        id: z.string(),
        filters: z.object({ expression: z.record(z.string(), z.unknown()) }).optional(),
      }),
    )
    .optional(),
  mentions: z
    .object({
      targets: z
        .array(
          z.object({
            id: z.string(),
            type: z.string(),
            filters: z.object({ expression: z.record(z.string(), z.unknown()) }).nullable().optional(),
          }),
        )
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  customPlaceholders: z.array(z.record(z.string(), z.unknown())).optional(),
  formatter: z.object({
    formatTables: z.boolean().optional(),
    stripImages: z.boolean().optional(),
    disableImageLinkPreviews: z.boolean().optional(),
    ignoreNewLines: z.boolean().optional(),
    connectionCreatedAt: z.string().optional(),
  }),
  splitOptions: z
    .object({
      isEnabled: z.boolean().nullable().optional(),
      splitChar: z.string().nullable().optional(),
      appendChar: z.string().nullable().optional(),
      prependChar: z.string().nullable().optional(),
    })
    .optional(),
  placeholderLimits: z
    .array(
      z.object({
        placeholder: z.string(),
        characterCount: z.number().int(),
        appendString: z.string().nullable().optional(),
      }),
    )
    .optional(),
  enablePlaceholderFallback: z.boolean().optional(),
});

const DiscordMediumEventSchema = z.object({
  id: z.string(),
  key: z.literal("discord"),
  filters: z.object({ expression: z.record(z.string(), z.unknown()) }).nullable(),
  rateLimits: z
    .array(
      z.object({
        id: z.string(),
        timeWindowSeconds: z.number().int(),
        limit: z.number().int(),
      }),
    )
    .optional(),
  details: DiscordMediumEventDetailsSchema,
});

/**
 * The full payload schema for `feed.deliver-articles`.
 *
 * Outer structure is strict so contract drift on the top-level fields is caught;
 * `userFeed` and inner medium details retain freeform escape hatches for fields
 * that exist in the current shape but aren't worth pinning down until they
 * stabilize.
 */
export const FeedDeliverArticlesSchema = z.object({
  // The feed and its connections (loose for now — the current type IUserFeed has 30+ fields)
  userFeed: z.record(z.string(), z.unknown()),
  // Delivery destinations (Discord today; Slack/Telegram in Bundle C)
  mediums: z.array(DiscordMediumEventSchema),
  // The articles to deliver (parsed RSS/Atom items, loose for now)
  articles: z.array(z.record(z.string(), z.unknown())),
});

export type FeedDeliverArticlesPayload = z.infer<typeof FeedDeliverArticlesSchema>;
export type DiscordMediumEvent = z.infer<typeof DiscordMediumEventSchema>;
export type DiscordMediumEventDetails = z.infer<typeof DiscordMediumEventDetailsSchema>;
