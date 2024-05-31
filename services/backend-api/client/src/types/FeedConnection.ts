import { array, boolean, InferType, number, object, string } from "yup";
import { FeedEmbedSchema } from "./FeedEmbed";
import { CustomPlaceholderSchema } from "./CustomPlaceholder";

export enum FeedConnectionType {
  DiscordChannel = "DISCORD_CHANNEL",
}

export enum FeedConnectionDisabledCode {
  Manual = "MANUAL",
  BadFormat = "BAD_FORMAT",
  MissingPermissions = "MISSING_PERMISSIONS",
  MissingMedium = "MISSING_MEDIUM",
}

export enum DiscordComponentType {
  Button = 2,
}

export enum DiscordComponentButtonStyle {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Link = 5,
}

const DiscordButtonSchema = object({
  id: string().required(),
  type: number().oneOf([DiscordComponentType.Button]).required(),
  label: string().required(),
  style: number()
    .oneOf(Object.values(DiscordComponentButtonStyle) as DiscordComponentButtonStyle[])
    .required(),
  url: string().required(),
});

const DiscordChannelConnectionDetailsSchema = object({
  embeds: array(FeedEmbedSchema).required(),
  channel: object({
    id: string().required(),
    guildId: string().required(),
    type: string().optional().nullable().oneOf(["forum", "thread"]),
  })
    .optional()
    .nullable(),
  webhook: object({
    id: string().required(),
    name: string().optional(),
    iconUrl: string().optional(),
    guildId: string().required(),
    type: string().nullable().oneOf(["forum", "thread"]),
    threadId: string(),
    isApplicationOwned: boolean(),
    channelId: string(),
  })
    .optional()
    .nullable(),
  componentRows: array(
    object({
      id: string().required(),
      components: array(DiscordButtonSchema.required()).required().max(5),
    }).required()
  ).max(5),
  content: string().optional(),
  forumThreadTitle: string().optional(),
  forumThreadTags: array(
    object({
      id: string().required(),
      filters: object({
        expression: object().required(),
      })
        .nullable()
        .default(null),
    }).required()
  )
    .optional()
    .nullable(),
  formatter: object({
    formatTables: boolean().default(false),
    stripImages: boolean().default(false),
    disableImageLinkPreviews: boolean().default(false),
    ignoreNewLines: boolean().default(false),
  }),
  placeholderLimits: array(
    object({
      characterCount: number().min(1).positive().integer().required(),
      placeholder: string().min(1).required(),
      appendString: string().optional().nullable(),
    }).required()
  )
    .optional()
    .nullable()
    .default(undefined),
  enablePlaceholderFallback: boolean().optional().default(false),
});

const DiscordWebhookConnectionDetailsSchema = object({
  embeds: array(FeedEmbedSchema).required(),
  webhook: object({
    id: string().required(),
    name: string().optional(),
    iconUrl: string().optional(),
    guildId: string().required(),
    type: string().nullable().oneOf(["forum"]),
  }).required(),
  content: string().optional(),
  forumThreadTitle: string(),
  formatter: object({
    formatTables: boolean().default(false),
    stripImages: boolean().default(false),
    disableImageLinkPreviews: boolean().default(false),
  }),
  placeholderLimits: array(
    object({
      characterCount: number().min(1).positive().integer().required(),
      placeholder: string().min(1).required(),
      appendString: string().optional().nullable(),
    }).required()
  )
    .optional()
    .nullable()
    .default(undefined),
  enablePlaceholderFallback: boolean().optional().default(false),
});

export const FeedConnectionSchema = object({
  id: string().required(),
  name: string().required(),
  key: string().oneOf(Object.values(FeedConnectionType)).required(),
  disabledCode: string().oneOf(Object.values(FeedConnectionDisabledCode)).optional(),
  splitOptions: object({
    splitChar: string().nullable(),
    appendChar: string().nullable(),
    prependChar: string().nullable(),
  })
    .optional()
    .nullable()
    .default(null),
  filters: object({
    expression: object(),
  })
    .optional()
    .default(undefined)
    .nullable(),
  rateLimits: array(
    object({
      id: string().required(),
      limit: number().positive().integer().required(),
      timeWindowSeconds: number().positive().integer().required(),
    }).required()
  )
    .default(undefined)
    .nullable(),
  mentions: object({
    targets: array(
      object({
        type: string().oneOf(["role", "user"]).required(),
        id: string().required(),
        filters: object({
          expression: object().required(),
        }).nullable(),
      }).required()
    )
      .nullable()
      .default(undefined),
  })
    .nullable()
    .default(undefined),
  customPlaceholders: array(CustomPlaceholderSchema.required()).nullable().default(undefined),
  details: object().when("key", ([key]) => {
    if (key === FeedConnectionType.DiscordChannel) {
      return DiscordChannelConnectionDetailsSchema;
    }

    throw new Error(`Unknown connection type: ${key}`);
  }),
});

export type FeedConnection = InferType<typeof FeedConnectionSchema>;
export type FeedDiscordChannelConnection = FeedConnection & {
  details: InferType<typeof DiscordChannelConnectionDetailsSchema>;
};
export type FeedDiscordWebhookConnection = FeedConnection & {
  details: InferType<typeof DiscordWebhookConnectionDetailsSchema>;
};
