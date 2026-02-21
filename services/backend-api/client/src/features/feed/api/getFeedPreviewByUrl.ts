import { InferType, array, number, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetFeedPreviewByUrlInput {
  details: {
    url: string;
  };
}

const GetFeedPreviewByUrlOutputSchema = object({
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

export type GetFeedPreviewByUrlOutput = InferType<typeof GetFeedPreviewByUrlOutputSchema>;

export const getFeedPreviewByUrl = async (
  options: GetFeedPreviewByUrlInput,
): Promise<GetFeedPreviewByUrlOutput> => {
  const res = await fetchRest("/api/v1/user-feeds/preview-by-url", {
    validateSchema: GetFeedPreviewByUrlOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.details),
    },
  });

  return res as GetFeedPreviewByUrlOutput;
};
