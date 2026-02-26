import { Type, type Static } from "@sinclair/typebox";
import { GetFeedArticlesFilterReturnType } from "../../services/feed-handler/types";
import {
  GetUserFeedsInputSortKey,
  UserFeedCopyableSetting,
} from "../../services/user-feeds/types";
import { UserFeedTargetFeedSelectionType } from "../../services/feed-connections-discord-channels/types";
import {
  NullableString,
  EmbedSchema,
  PlaceholderLimitSchema,
} from "../../shared/schemas/discord-embed.schemas";
import { AjvKeyword } from "../../infra/ajv-plugins";

export const CreateUserFeedBodySchema = Type.Object({
  url: Type.String({ minLength: 1 }),
  title: Type.Optional(Type.String()),
  sourceFeedId: Type.Optional(Type.String()),
});
export type CreateUserFeedBody = Static<typeof CreateUserFeedBodySchema>;

export const DeduplicateFeedUrlsBodySchema = Type.Object({
  urls: Type.Array(Type.String({ minLength: 1 })),
});
export type DeduplicateFeedUrlsBody = Static<
  typeof DeduplicateFeedUrlsBodySchema
>;

export const ValidateUrlBodySchema = Type.Object({
  url: Type.String({ minLength: 1 }),
});
export type ValidateUrlBody = Static<typeof ValidateUrlBodySchema>;

export const PreviewByUrlBodySchema = Type.Object(
  {
    url: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
export type PreviewByUrlBody = Static<typeof PreviewByUrlBodySchema>;

export const CloneUserFeedBodySchema = Type.Object(
  {
    title: Type.Optional(Type.String()),
    url: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type CloneUserFeedBody = Static<typeof CloneUserFeedBodySchema>;

export const GetUserFeedParamsSchema = Type.Object({
  feedId: Type.String({ minLength: 1 }),
});
export type GetUserFeedParams = Static<typeof GetUserFeedParamsSchema>;

export enum UpdateUserFeedsOp {
  BulkDelete = "bulk-delete",
  BulkDisable = "bulk-disable",
  BulkEnable = "bulk-enable",
}

export const UpdateUserFeedsBodySchema = Type.Object(
  {
    op: Type.Enum(UpdateUserFeedsOp),
    data: Type.Object(
      {
        feeds: Type.Array(
          Type.Object(
            { id: Type.String({ minLength: 1 }) },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type UpdateUserFeedsBody = Static<typeof UpdateUserFeedsBodySchema>;

export const SUPPORTED_DATE_LOCALES = [
  "af",
  "am",
  "ar-dz",
  "ar-iq",
  "ar-kw",
  "ar-ly",
  "ar-ma",
  "ar-sa",
  "ar-tn",
  "ar",
  "az",
  "be",
  "bg",
  "bi",
  "bm",
  "bn-bd",
  "bn",
  "bo",
  "br",
  "bs",
  "ca",
  "cs",
  "cv",
  "cy",
  "da",
  "de-at",
  "de-ch",
  "de",
  "dv",
  "el",
  "en-au",
  "en-ca",
  "en-gb",
  "en-ie",
  "en-il",
  "en-in",
  "en-nz",
  "en-sg",
  "en-tt",
  "en",
  "eo",
  "es-do",
  "es",
  "et",
  "eu",
  "fa",
  "fi",
  "fo",
  "fr-ca",
  "fr-ch",
  "fr",
  "fy",
  "ga",
  "gd",
  "gl",
  "gom-latn",
  "gu",
  "he",
  "hi",
  "hr",
  "ht",
  "hu",
  "hy-am",
  "id",
  "is",
  "it-ch",
  "it",
  "ja",
  "jv",
  "ka",
  "kk",
  "km",
  "kn",
  "ko",
  "ku",
  "ky",
  "lb",
  "lo",
  "lt",
  "lv",
  "me",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms-my",
  "ms",
  "mt",
  "my",
  "nb",
  "ne",
  "nl-be",
  "nl",
  "nn",
  "oc-lnc",
  "pa-in",
  "pl",
  "pt-br",
  "pt",
  "rn",
  "ro",
  "ru",
  "rw",
  "sd",
  "se",
  "si",
  "sk",
  "sl",
  "sq",
  "sr-cyrl",
  "sr",
  "ss",
  "sv-fi",
  "sv",
  "sw",
  "ta",
  "te",
  "tet",
  "tg",
  "th",
  "tk",
  "tl-ph",
  "tlh",
  "tr",
  "tzl",
  "tzm-latn",
  "tzm",
  "ug-cn",
  "uk",
  "ur",
  "uz-latn",
  "uz",
  "vi",
  "x-pseudo",
  "yo",
  "zh-cn",
  "zh-hk",
  "zh-tw",
  "zh",
  "es-pr",
  "es-mx",
  "es-us",
] as const;

const TimezoneString = Type.Unsafe<string>({
  type: "string",
  [AjvKeyword.IS_TIMEZONE]: true,
});

const DateLocaleString = Type.String({
  enum: ["", ...SUPPORTED_DATE_LOCALES],
});

export const DatePreviewBodySchema = Type.Object(
  {
    dateFormat: Type.Optional(Type.String()),
    dateTimezone: Type.Optional(Type.String()),
    dateLocale: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type DatePreviewBody = Static<typeof DatePreviewBodySchema>;

const WebhookSchema = Type.Union([
  Type.Object(
    {
      name: Type.String({ minLength: 1 }),
      iconUrl: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Null(),
]);

const UserFeedFormatOptionsSchema = Type.Union([
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

export const SendTestArticleBodySchema = Type.Object(
  {
    article: Type.Object(
      { id: Type.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
    channelId: Type.String({ minLength: 1 }),
    content: Type.Optional(Type.String()),
    embeds: Type.Optional(Type.Array(EmbedSchema)),
    componentsV2: Type.Optional(
      Type.Union([
        Type.Array(Type.Object({}, { additionalProperties: true })),
        Type.Null(),
      ]),
    ),
    placeholderLimits: Type.Optional(Type.Array(PlaceholderLimitSchema)),
    webhook: Type.Optional(WebhookSchema),
    threadId: Type.Optional(Type.String()),
    channelNewThread: Type.Optional(Type.Boolean()),
    userFeedFormatOptions: Type.Optional(UserFeedFormatOptionsSchema),
  },
  { additionalProperties: false },
);
export type SendTestArticleBody = Static<typeof SendTestArticleBodySchema>;

export const UpdateUserFeedBodySchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1 })),
    url: Type.Optional(Type.String({ minLength: 1 })),
    disabledCode: Type.Optional(
      Type.Union([Type.Literal("MANUAL"), Type.Null()]),
    ),
    passingComparisons: Type.Optional(
      Type.Array(Type.String({ minLength: 1 })),
    ),
    blockingComparisons: Type.Optional(
      Type.Array(Type.String({ minLength: 1 })),
    ),
    formatOptions: Type.Optional(
      Type.Object(
        {
          dateFormat: Type.Optional(Type.String()),
          dateTimezone: Type.Optional(TimezoneString),
          dateLocale: Type.Optional(DateLocaleString),
        },
        { additionalProperties: false },
      ),
    ),
    dateCheckOptions: Type.Optional(
      Type.Object(
        {
          oldArticleDateDiffMsThreshold: Type.Optional(
            Type.Integer({ minimum: 0 }),
          ),
        },
        { additionalProperties: false },
      ),
    ),
    shareManageOptions: Type.Optional(
      Type.Object(
        {
          invites: Type.Array(
            Type.Object(
              { discordUserId: Type.String({ minLength: 1 }) },
              { additionalProperties: false },
            ),
          ),
        },
        { additionalProperties: false },
      ),
    ),
    userRefreshRateSeconds: Type.Optional(
      Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    ),
    externalProperties: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: Type.String({ minLength: 1 }),
            sourceField: Type.String({ minLength: 1 }),
            label: Type.String({ minLength: 1 }),
            cssSelector: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false },
        ),
      ),
    ),
  },
  { additionalProperties: false },
);
export type UpdateUserFeedBody = Static<typeof UpdateUserFeedBodySchema>;

export const GetFeedRequestsQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 25 })),
  skip: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});
export type GetFeedRequestsQuery = Static<typeof GetFeedRequestsQuerySchema>;

export const DeliveryPreviewBodySchema = Type.Object(
  {
    skip: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
    limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 50, default: 10 }),
    ),
  },
  { additionalProperties: false },
);
export type DeliveryPreviewBody = Static<typeof DeliveryPreviewBodySchema>;

export const GetDeliveryLogsQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 25 })),
  skip: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000, default: 0 })),
});
export type GetDeliveryLogsQuery = Static<typeof GetDeliveryLogsQuerySchema>;

export type CustomPlaceholderStep =
  | {
      id?: string;
      type: "REGEX";
      regexSearch: string;
      regexSearchFlags?: string | null;
      replacementString?: string | null;
    }
  | {
      id?: string;
      type: "URL_ENCODE";
    }
  | {
      id?: string;
      type: "DATE_FORMAT";
      format: string;
      timezone?: string | null;
      locale?: string | null;
    }
  | {
      id?: string;
      type: "UPPERCASE";
    }
  | {
      id?: string;
      type: "LOWERCASE";
    };

// Step schemas must NOT use additionalProperties: false because AJV's
// removeAdditional option (set globally) mutates data during oneOf evaluation,
// stripping properties from earlier branches before later branches are checked.
const RegexStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("REGEX"),
  regexSearch: Type.String({ minLength: 1 }),
  regexSearchFlags: Type.Optional(NullableString),
  replacementString: Type.Optional(NullableString),
});

const UrlEncodeStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("URL_ENCODE"),
});

const DateFormatStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("DATE_FORMAT"),
  format: Type.String({ minLength: 1 }),
  timezone: Type.Optional(NullableString),
  locale: Type.Optional(NullableString),
});

const UppercaseStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("UPPERCASE"),
});

const LowercaseStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Literal("LOWERCASE"),
});

const CustomPlaceholderStepSchema = Type.Unsafe<CustomPlaceholderStep>({
  oneOf: [
    RegexStepSchema,
    UrlEncodeStepSchema,
    DateFormatStepSchema,
    UppercaseStepSchema,
    LowercaseStepSchema,
  ],
});

const ExternalPropertySchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    sourceField: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    cssSelector: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const CustomPlaceholderSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    referenceName: Type.String({ minLength: 1 }),
    sourcePlaceholder: Type.String({ minLength: 1 }),
    steps: Type.Array(CustomPlaceholderStepSchema),
  },
  { additionalProperties: false },
);

const GetArticlesFormatterOptionsSchema = Type.Object(
  {
    formatTables: Type.Boolean({ default: false }),
    stripImages: Type.Boolean({ default: false }),
    disableImageLinkPreviews: Type.Boolean({ default: false }),
    ignoreNewLines: Type.Optional(Type.Boolean()),
    dateFormat: Type.Optional(Type.String()),
    dateTimezone: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const GetArticlesFormatterSchema = Type.Object(
  {
    options: GetArticlesFormatterOptionsSchema,
    customPlaceholders: Type.Optional(
      Type.Union([Type.Array(CustomPlaceholderSchema), Type.Null()]),
    ),
    externalProperties: Type.Optional(
      Type.Union([Type.Array(ExternalPropertySchema), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);

const GetArticlesFiltersSchema = Type.Object(
  {
    returnType: Type.Optional(
      Type.String({
        enum: Object.values(GetFeedArticlesFilterReturnType),
      }),
    ),
    expression: Type.Optional(Type.Object({}, { additionalProperties: true })),
    articleId: Type.Optional(Type.String()),
    articleIdHashes: Type.Optional(Type.Array(Type.String())),
    search: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const GetArticlesBodySchema = Type.Object(
  {
    limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 50, default: 25 }),
    ),
    skip: Type.Optional(
      Type.Integer({ minimum: 0, maximum: 1000, default: 0 }),
    ),
    random: Type.Optional(Type.Boolean()),
    selectProperties: Type.Optional(Type.Array(Type.String())),
    selectPropertyTypes: Type.Optional(Type.Array(Type.String())),
    filters: Type.Optional(GetArticlesFiltersSchema),
    formatter: GetArticlesFormatterSchema,
    includeHtmlInErrors: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type GetArticlesBody = Static<typeof GetArticlesBodySchema>;

export const GetArticlePropertiesBodySchema = Type.Object(
  {
    customPlaceholders: Type.Optional(
      Type.Union([
        Type.Array(
          Type.Object(
            {
              id: Type.Optional(Type.String()),
              referenceName: Type.String({ minLength: 1 }),
              sourcePlaceholder: Type.String({ minLength: 1 }),
              steps: Type.Array(CustomPlaceholderStepSchema),
            },
            { additionalProperties: false },
          ),
        ),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);
export type GetArticlePropertiesBody = Static<
  typeof GetArticlePropertiesBodySchema
>;

export const CopySettingsBodySchema = Type.Object(
  {
    settings: Type.Array(Type.Enum(UserFeedCopyableSetting)),
    targetFeedIds: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    targetFeedSelectionType: Type.Optional(
      Type.Enum(UserFeedTargetFeedSelectionType),
    ),
    targetFeedSearch: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type CopySettingsBody = Static<typeof CopySettingsBodySchema>;

export const GetUserFeedsQuerySchema = Type.Object({
  limit: Type.Integer({ minimum: 1 }),
  offset: Type.Integer({ minimum: 0 }),
  search: Type.Optional(Type.String()),
  sort: Type.Optional(
    Type.String({
      enum: ["", ...Object.values(GetUserFeedsInputSortKey)],
    }),
  ),
});
export type GetUserFeedsQuery = Static<typeof GetUserFeedsQuerySchema>;
