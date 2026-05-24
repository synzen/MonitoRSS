import { InferType, array, number, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetCuratedFeedPreviewInput {
  details: {
    curatedFeedId: string;
  };
}

const GetCuratedFeedPreviewOutputSchema = object({
  result: object({
    articles: array(
      object({
        title: string().required(),
        date: string().optional(),
        url: string().optional(),
      }),
    ).required(),
    requestStatus: string().required(),
    responseStatusCode: number().optional(),
  }),
}).required();

export type GetCuratedFeedPreviewOutput = InferType<typeof GetCuratedFeedPreviewOutputSchema>;

export const getCuratedFeedPreview = async (
  options: GetCuratedFeedPreviewInput,
): Promise<GetCuratedFeedPreviewOutput> => {
  const { curatedFeedId } = options.details;
  const res = await fetchRest(
    `/api/v1/curated-feeds/${encodeURIComponent(curatedFeedId)}/preview`,
    {
      validateSchema: GetCuratedFeedPreviewOutputSchema,
      requestOptions: {
        method: "POST",
        body: JSON.stringify({}),
      },
    },
  );

  return res as GetCuratedFeedPreviewOutput;
};
