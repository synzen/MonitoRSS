import { Type, type Static } from "@sinclair/typebox";
import {
  EmbedSchema,
  PlaceholderLimitSchema,
} from "../../shared/schemas/discord-embed.schemas";

export const CreateConnectionParamsSchema = Type.Object({
  feedId: Type.String({ minLength: 1 }),
});
export type CreateConnectionParams = Static<
  typeof CreateConnectionParamsSchema
>;

const FormatterOptionsSchema = Type.Object(
  {
    formatTables: Type.Optional(Type.Boolean()),
    stripImages: Type.Optional(Type.Boolean()),
    disableImageLinkPreviews: Type.Optional(Type.Boolean()),
    ignoreNewLines: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const WebhookSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.Optional(Type.String()),
    iconUrl: Type.Optional(Type.String()),
    threadId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const ApplicationWebhookSchema = Type.Object(
  {
    channelId: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    iconUrl: Type.Optional(Type.String()),
    threadId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const CreateDiscordChannelConnectionBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 250 }),
    channelId: Type.Optional(Type.String()),
    webhook: Type.Optional(WebhookSchema),
    applicationWebhook: Type.Optional(ApplicationWebhookSchema),
    threadCreationMethod: Type.Optional(Type.Literal("new-thread")),
    content: Type.Optional(Type.String()),
    embeds: Type.Optional(Type.Array(EmbedSchema)),
    componentsV2: Type.Optional(
      Type.Union([
        Type.Array(Type.Object({}, { additionalProperties: true })),
        Type.Null(),
      ]),
    ),
    placeholderLimits: Type.Optional(Type.Array(PlaceholderLimitSchema)),
    formatter: Type.Optional(Type.Union([FormatterOptionsSchema, Type.Null()])),
  },
  { additionalProperties: false },
);
export type CreateDiscordChannelConnectionBody = Static<
  typeof CreateDiscordChannelConnectionBodySchema
>;
