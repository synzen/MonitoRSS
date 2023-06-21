import { array, boolean, InferType, object, string } from "yup";
import { FeedEmbedSchema } from "./FeedEmbed";

export enum FeedConnectionType {
  DiscordChannel = "DISCORD_CHANNEL",
  DiscordWebhook = "DISCORD_WEBHOOK",
}

export enum FeedConnectionDisabledCode {
  Manual = "MANUAL",
  BadFormat = "BAD_FORMAT",
  MissingPermissions = "MISSING_PERMISSIONS",
  MissingMedium = "MISSING_MEDIUM",
}

const DiscordChannelConnectionDetailsSchema = object({
  embeds: array(FeedEmbedSchema).required(),
  channel: object({
    id: string().required(),
    guildId: string().required(),
    type: string().optional().nullable().oneOf(["forum"]),
  }).required(),
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
    formatTables: boolean().required(),
    stripImages: boolean().required(),
  }).required(),
});

const DiscordWebhookConnectionDetailsSchema = object({
  embeds: array(FeedEmbedSchema).required(),
  webhook: object({
    id: string().required(),
    name: string().optional(),
    iconUrl: string().optional(),
    guildId: string().required(),
  }).required(),
  content: string().optional(),
  formatter: object({
    formatTables: boolean().required(),
    stripImages: boolean().required(),
  }).required(),
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
  details: object().when("key", ([key]) => {
    if (key === FeedConnectionType.DiscordWebhook) {
      return DiscordWebhookConnectionDetailsSchema;
    }

    return DiscordChannelConnectionDetailsSchema;
  }),
});

export type FeedConnection = InferType<typeof FeedConnectionSchema>;
export type FeedDiscordChannelConnection = FeedConnection & {
  details: InferType<typeof DiscordChannelConnectionDetailsSchema>;
};
export type FeedDiscordWebhookConnection = FeedConnection & {
  details: InferType<typeof DiscordWebhookConnectionDetailsSchema>;
};
