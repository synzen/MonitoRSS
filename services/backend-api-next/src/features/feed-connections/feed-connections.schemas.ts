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

export const ConnectionActionParamsSchema = Type.Object({
  feedId: Type.String({ minLength: 1 }),
  connectionId: Type.String({ minLength: 1 }),
});
export type ConnectionActionParams = Static<
  typeof ConnectionActionParamsSchema
>;

const SplitOptionsSchema = Type.Union([
  Type.Object(
    {
      isEnabled: Type.Optional(Type.Boolean()),
      splitChar: Type.Optional(Type.String()),
      appendChar: Type.Optional(Type.String()),
      prependChar: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Null(),
]);

const MentionTargetSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    type: Type.String({ minLength: 1 }),
    filters: Type.Optional(
      Type.Union([
        Type.Object(
          { expression: Type.Object({}, { additionalProperties: true }) },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);

const MentionsSchema = Type.Union([
  Type.Object(
    {
      targets: Type.Optional(
        Type.Union([Type.Array(MentionTargetSchema), Type.Null()]),
      ),
    },
    { additionalProperties: false },
  ),
  Type.Null(),
]);

const RegexStepSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    type: Type.Literal("REGEX"),
    regexSearch: Type.String({ minLength: 1 }),
    regexSearchFlags: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    replacementString: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { additionalProperties: false },
);

const UrlEncodeStepSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    type: Type.Literal("URL_ENCODE"),
  },
  { additionalProperties: false },
);

const DateFormatStepSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    type: Type.Literal("DATE_FORMAT"),
    format: Type.String({ minLength: 1 }),
    timezone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    locale: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { additionalProperties: false },
);

const UppercaseStepSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    type: Type.Literal("UPPERCASE"),
  },
  { additionalProperties: false },
);

const LowercaseStepSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    type: Type.Literal("LOWERCASE"),
  },
  { additionalProperties: false },
);

const PreviewCustomPlaceholderStepSchema = Type.Unsafe({
  oneOf: [
    RegexStepSchema,
    UrlEncodeStepSchema,
    DateFormatStepSchema,
    UppercaseStepSchema,
    LowercaseStepSchema,
  ],
});

const PreviewCustomPlaceholderSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    referenceName: Type.String({ minLength: 1 }),
    sourcePlaceholder: Type.String({ minLength: 1 }),
    steps: Type.Array(PreviewCustomPlaceholderStepSchema),
  },
  { additionalProperties: false },
);

const PreviewExternalPropertySchema = Type.Object(
  {
    sourceField: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    cssSelector: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const ComponentRowSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    components: Type.Optional(
      Type.Array(Type.Object({}, { additionalProperties: true })),
    ),
  },
  { additionalProperties: false },
);

const ForumThreadTagSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    filters: Type.Optional(
      Type.Object(
        { expression: Type.Object({}, { additionalProperties: true }) },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const ConnectionFormatOptionsSchema = Type.Union([
  Type.Object(
    {
      formatTables: Type.Optional(Type.Boolean()),
      stripImages: Type.Optional(Type.Boolean()),
      disableImageLinkPreviews: Type.Optional(Type.Boolean()),
      ignoreNewLines: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
  Type.Null(),
]);

const PreviewUserFeedFormatOptionsSchema = Type.Union([
  Type.Object(
    {
      dateFormat: Type.Optional(Type.String()),
      dateTimezone: Type.Optional(Type.String()),
      dateLocale: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Null(),
]);

export const SendConnectionTestArticleBodySchema = Type.Object(
  {
    article: Type.Object(
      { id: Type.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
    content: Type.Optional(Type.String()),
    embeds: Type.Optional(Type.Array(EmbedSchema)),
    channelNewThreadTitle: Type.Optional(Type.String()),
    channelNewThreadExcludesPreview: Type.Optional(Type.Boolean()),
    componentRows: Type.Optional(Type.Array(ComponentRowSchema)),
    forumThreadTitle: Type.Optional(Type.String({ maxLength: 100 })),
    forumThreadTags: Type.Optional(Type.Array(ForumThreadTagSchema)),
    splitOptions: Type.Optional(SplitOptionsSchema),
    mentions: Type.Optional(MentionsSchema),
    customPlaceholders: Type.Optional(
      Type.Union([Type.Array(PreviewCustomPlaceholderSchema), Type.Null()]),
    ),
    externalProperties: Type.Optional(
      Type.Union([Type.Array(PreviewExternalPropertySchema), Type.Null()]),
    ),
    placeholderLimits: Type.Optional(Type.Array(PlaceholderLimitSchema)),
    connectionFormatOptions: Type.Optional(ConnectionFormatOptionsSchema),
    userFeedFormatOptions: Type.Optional(PreviewUserFeedFormatOptionsSchema),
    enablePlaceholderFallback: Type.Optional(Type.Boolean()),
    includeCustomPlaceholderPreviews: Type.Optional(Type.Boolean()),
    componentsV2: Type.Optional(
      Type.Union([
        Type.Array(Type.Object({}, { additionalProperties: true })),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);
export type SendConnectionTestArticleBody = Static<
  typeof SendConnectionTestArticleBodySchema
>;

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
