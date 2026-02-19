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

export const GetCuratedFeedsResponseSchema = Type.Object({
  result: Type.Object({
    categories: Type.Array(CuratedCategorySchema),
    feeds: Type.Array(CuratedFeedSchema),
  }),
});
export type GetCuratedFeedsResponse = Static<
  typeof GetCuratedFeedsResponseSchema
>;
