import { array, InferType, object, string, boolean } from "yup";
import fetchRest from "../../../utils/fetchRest";

const CuratedCategorySchema = object({
  id: string().required(),
  label: string().required(),
}).required();

const CuratedFeedSchema = object({
  id: string().required(),
  title: string().required(),
  category: string().required(),
  domain: string().required(),
  description: string().required(),
  popular: boolean().optional(),
}).required();

const GetCuratedFeedsOutputSchema = object({
  result: object({
    categories: array(CuratedCategorySchema).required(),
    feeds: array(CuratedFeedSchema).required(),
  }).required(),
}).required();

export type GetCuratedFeedsOutput = InferType<typeof GetCuratedFeedsOutputSchema>;

export interface GetCuratedFeedsInput {
  q?: string;
  category?: string;
  limit?: number;
}

export const getCuratedFeeds = async (
  input: GetCuratedFeedsInput = {},
): Promise<GetCuratedFeedsOutput> => {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.category) params.set("category", input.category);
  if (input.limit != null) params.set("limit", String(input.limit));

  const queryString = params.toString();
  const url = queryString ? `/api/v1/curated-feeds?${queryString}` : "/api/v1/curated-feeds";

  const res = await fetchRest(url, {
    validateSchema: GetCuratedFeedsOutputSchema,
  });

  return res as GetCuratedFeedsOutput;
};
