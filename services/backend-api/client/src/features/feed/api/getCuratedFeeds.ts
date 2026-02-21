import { array, InferType, object, string, boolean } from "yup";
import fetchRest from "../../../utils/fetchRest";

const CuratedCategorySchema = object({
  id: string().required(),
  label: string().required(),
}).required();

const CuratedFeedSchema = object({
  url: string().required(),
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

export const getCuratedFeeds = async (): Promise<GetCuratedFeedsOutput> => {
  const res = await fetchRest("/api/v1/curated-feeds", {
    validateSchema: GetCuratedFeedsOutputSchema,
  });

  return res as GetCuratedFeedsOutput;
};
