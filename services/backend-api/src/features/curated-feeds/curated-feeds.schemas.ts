import { Type, type Static } from "@sinclair/typebox";

export const CuratedCategorySchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
});
export type CuratedCategory = Static<typeof CuratedCategorySchema>;

export const CuratedFeedSchema = Type.Object({
  url: Type.String(),
  title: Type.String(),
  category: Type.String(),
  domain: Type.String(),
  description: Type.String(),
  popular: Type.Optional(Type.Boolean()),
});
export type CuratedFeed = Static<typeof CuratedFeedSchema>;

export const MAX_CURATED_FEEDS_LIMIT = 25;
export const MIN_CURATED_FEEDS_SEARCH_LENGTH = 3;

export const GetCuratedFeedsQuerySchema = Type.Object({
  q: Type.Optional(
    Type.String({ minLength: MIN_CURATED_FEEDS_SEARCH_LENGTH, maxLength: 100 }),
  ),
  category: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: MAX_CURATED_FEEDS_LIMIT }),
  ),
});
export type GetCuratedFeedsQuery = Static<typeof GetCuratedFeedsQuerySchema>;

export const GetCuratedFeedsResponseSchema = Type.Object({
  result: Type.Object({
    categories: Type.Array(CuratedCategorySchema),
    feeds: Type.Array(CuratedFeedSchema),
  }),
});
export type GetCuratedFeedsResponse = Static<
  typeof GetCuratedFeedsResponseSchema
>;
