import { Type, type Static } from "@sinclair/typebox";
import { AjvKeyword } from "../../infra/ajv-plugins";

const FeedListSortKeySchema = Type.Union([
  Type.Literal("title"),
  Type.Literal("url"),
  Type.Literal("createdAt"),
  Type.Literal("ownedByUser"),
  Type.Literal("computedStatus"),
  Type.Literal("refreshRateSeconds"),
]);

const FeedListSortDirectionSchema = Type.Union([
  Type.Literal("asc"),
  Type.Literal("desc"),
]);

const FeedListSortSchema = Type.Object(
  {
    key: FeedListSortKeySchema,
    direction: FeedListSortDirectionSchema,
  },
  { additionalProperties: false },
);

const FeedListColumnVisibilitySchema = Type.Object(
  {
    computedStatus: Type.Optional(Type.Boolean()),
    title: Type.Optional(Type.Boolean()),
    url: Type.Optional(Type.Boolean()),
    createdAt: Type.Optional(Type.Boolean()),
    ownedByUser: Type.Optional(Type.Boolean()),
    refreshRateSeconds: Type.Optional(Type.Boolean()),
  },
  {
    additionalProperties: false,
    [AjvKeyword.HAS_AT_LEAST_ONE_VISIBLE_COLUMN]: true,
  },
);

const FeedListColumnOrderSchema = Type.Object(
  {
    columns: Type.Array(
      Type.Union([
        Type.Literal("title"),
        Type.Literal("computedStatus"),
        Type.Literal("url"),
        Type.Literal("createdAt"),
        Type.Literal("refreshRateSeconds"),
        Type.Literal("ownedByUser"),
      ]),
    ),
  },
  { additionalProperties: false },
);

const FeedListStatusFiltersSchema = Type.Object(
  {
    statuses: Type.Array(
      Type.Union([
        Type.Literal("OK"),
        Type.Literal("REQUIRES_ATTENTION"),
        Type.Literal("MANUALLY_DISABLED"),
        Type.Literal("RETRYING"),
      ]),
    ),
  },
  { additionalProperties: false },
);

const UpdateMePreferencesSchema = Type.Object(
  {
    alertOnDisabledFeeds: Type.Optional(Type.Boolean()),
    dateFormat: Type.Optional(Type.String()),
    dateTimezone: Type.Optional(
      Type.String({ [AjvKeyword.IS_TIMEZONE]: true }),
    ),
    dateLocale: Type.Optional(
      Type.String({ [AjvKeyword.IS_DATE_LOCALE]: true }),
    ),
    feedListSort: Type.Optional(Type.Union([FeedListSortSchema, Type.Null()])),
    feedListColumnVisibility: Type.Optional(FeedListColumnVisibilitySchema),
    feedListColumnOrder: Type.Optional(FeedListColumnOrderSchema),
    feedListStatusFilters: Type.Optional(FeedListStatusFiltersSchema),
  },
  { additionalProperties: false },
);

export const UpdateMeBodySchema = Type.Object(
  {
    preferences: Type.Optional(UpdateMePreferencesSchema),
  },
  { additionalProperties: false },
);

export type UpdateMeBody = Static<typeof UpdateMeBodySchema>;
