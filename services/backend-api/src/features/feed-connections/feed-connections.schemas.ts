import { Type, type Static } from "@sinclair/typebox";
import {
  EmbedSchema,
  PlaceholderLimitSchema,
} from "../../shared/schemas/discord-embed.schemas";
import { SUPPORTED_DATE_LOCALES } from "../user-feeds/user-feeds.schemas";
import { AjvKeyword } from "../../infra/ajv-plugins";

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

const RegexStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("REGEX"),
  regexSearch: Type.String({ minLength: 1 }),
  regexSearchFlags: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  replacementString: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const UrlEncodeStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("URL_ENCODE"),
});

const DateFormatStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("DATE_FORMAT"),
  format: Type.String({ minLength: 1 }),
  timezone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  locale: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const UppercaseStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("UPPERCASE"),
});

const LowercaseStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("LOWERCASE"),
});

const PreviewCustomPlaceholderStepSchema = Type.Union([
  RegexStepSchema,
  UrlEncodeStepSchema,
  DateFormatStepSchema,
  UppercaseStepSchema,
  LowercaseStepSchema,
]);

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

const TimezoneString = Type.Unsafe<string>({
  type: "string",
  [AjvKeyword.IS_TIMEZONE]: true,
});

const DateLocaleString = Type.String({
  enum: ["", ...SUPPORTED_DATE_LOCALES],
});

const PreviewUserFeedFormatOptionsSchema = Type.Union([
  Type.Object(
    {
      dateFormat: Type.Optional(Type.String()),
      dateTimezone: Type.Optional(TimezoneString),
      dateLocale: Type.Optional(DateLocaleString),
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
    content: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    embeds: Type.Optional(Type.Array(EmbedSchema)),
    channelNewThreadTitle: Type.Optional(Type.String()),
    channelNewThreadExcludesPreview: Type.Optional(Type.Boolean()),
    componentRows: Type.Optional(
      Type.Union([Type.Array(ComponentRowSchema), Type.Null()]),
    ),
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

export const CreatePreviewBodySchema = Type.Object(
  {
    article: Type.Optional(
      Type.Object(
        { id: Type.String({ minLength: 1 }) },
        { additionalProperties: false },
      ),
    ),
    content: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    embeds: Type.Optional(Type.Array(EmbedSchema)),
    channelNewThreadTitle: Type.Optional(Type.String()),
    channelNewThreadExcludesPreview: Type.Optional(Type.Boolean()),
    componentRows: Type.Optional(
      Type.Union([Type.Array(ComponentRowSchema), Type.Null()]),
    ),
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
export type CreatePreviewBody = Static<typeof CreatePreviewBodySchema>;

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

export const CopyConnectionSettingsBodySchema = Type.Object(
  {
    properties: Type.Array(
      Type.Union([
        Type.Literal("embeds"),
        Type.Literal("webhookName"),
        Type.Literal("webhookIconUrl"),
        Type.Literal("webhookThread"),
        Type.Literal("placeholderLimits"),
        Type.Literal("content"),
        Type.Literal("contentFormatTables"),
        Type.Literal("contentStripImages"),
        Type.Literal("ignoreNewLines"),
        Type.Literal("contentDisableImageLinkPreviews"),
        Type.Literal("components"),
        Type.Literal("componentsV2"),
        Type.Literal("forumThreadTitle"),
        Type.Literal("forumThreadTags"),
        Type.Literal("placeholderFallbackSetting"),
        Type.Literal("filters"),
        Type.Literal("splitOptions"),
        Type.Literal("customPlaceholders"),
        Type.Literal("deliveryRateLimits"),
        Type.Literal("messageMentions"),
        Type.Literal("channel"),
      ]),
      { minItems: 1 },
    ),
    targetDiscordChannelConnectionIds: Type.Array(
      Type.String({ minLength: 1 }),
      { minItems: 1 },
    ),
  },
  { additionalProperties: false },
);
export type CopyConnectionSettingsBody = Static<
  typeof CopyConnectionSettingsBodySchema
>;

export const CloneConnectionBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    channelId: Type.Optional(Type.String()),
    targetFeedIds: Type.Optional(Type.Array(Type.String())),
    targetFeedSelectionType: Type.Optional(
      Type.Union([Type.Literal("all"), Type.Literal("selected")]),
    ),
    targetFeedSearch: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type CloneConnectionBody = Static<typeof CloneConnectionBodySchema>;

export const CreateTemplatePreviewBodySchema = Type.Object(
  {
    article: Type.Object(
      { id: Type.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
    content: Type.Optional(Type.String()),
    embeds: Type.Optional(Type.Array(EmbedSchema)),
    placeholderLimits: Type.Optional(Type.Array(PlaceholderLimitSchema)),
    userFeedFormatOptions: Type.Optional(PreviewUserFeedFormatOptionsSchema),
    connectionFormatOptions: Type.Optional(ConnectionFormatOptionsSchema),
    enablePlaceholderFallback: Type.Optional(Type.Boolean()),
    componentsV2: Type.Optional(
      Type.Union([
        Type.Array(Type.Object({}, { additionalProperties: true })),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);
export type CreateTemplatePreviewBody = Static<
  typeof CreateTemplatePreviewBodySchema
>;

const FiltersSchema = Type.Union([
  Type.Object(
    { expression: Type.Object({}, { additionalProperties: true }) },
    { additionalProperties: false },
  ),
  Type.Null(),
]);

const CustomRateLimitSchema = Type.Object(
  {
    timeWindowSeconds: Type.Integer({ minimum: 1, maximum: 2592000 }),
    limit: Type.Integer({ minimum: 1, maximum: 10000 }),
  },
  { additionalProperties: false },
);

export const UpdateDiscordChannelConnectionBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 250 })),
    channelId: Type.Optional(Type.String()),
    channelNewThreadTitle: Type.Optional(Type.String()),
    channelNewThreadExcludesPreview: Type.Optional(Type.Boolean()),
    webhook: Type.Optional(WebhookSchema),
    applicationWebhook: Type.Optional(ApplicationWebhookSchema),
    content: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    forumThreadTitle: Type.Optional(Type.String({ maxLength: 100 })),
    forumThreadTags: Type.Optional(Type.Array(ForumThreadTagSchema)),
    filters: Type.Optional(FiltersSchema),
    mentions: Type.Optional(MentionsSchema),
    placeholderLimits: Type.Optional(Type.Array(PlaceholderLimitSchema)),
    embeds: Type.Optional(Type.Array(EmbedSchema)),
    componentRows: Type.Optional(
      Type.Union([
        Type.Array(ComponentRowSchema, { maxItems: 5 }),
        Type.Null(),
      ]),
    ),
    disabledCode: Type.Optional(
      Type.Union([Type.Literal("MANUAL"), Type.Null()]),
    ),
    splitOptions: Type.Optional(SplitOptionsSchema),
    formatter: Type.Optional(Type.Union([FormatterOptionsSchema, Type.Null()])),
    enablePlaceholderFallback: Type.Optional(Type.Boolean()),
    customPlaceholders: Type.Optional(
      Type.Union([Type.Array(PreviewCustomPlaceholderSchema), Type.Null()]),
    ),
    rateLimits: Type.Optional(
      Type.Union([Type.Array(CustomRateLimitSchema), Type.Null()]),
    ),
    threadCreationMethod: Type.Optional(
      Type.Union([Type.Literal("new-thread"), Type.Null()]),
    ),
    componentsV2: Type.Optional(
      Type.Union([
        Type.Array(Type.Object({}, { additionalProperties: true })),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);
export type UpdateDiscordChannelConnectionBody = Static<
  typeof UpdateDiscordChannelConnectionBodySchema
>;
