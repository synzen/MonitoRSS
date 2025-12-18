import { array, InferType, mixed, number, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { ArticleDiagnosticResultSchema } from "../types/ArticleDiagnostics";

export interface GetArticleDiagnosticsInput {
  feedId: string;
  data: {
    skip: number;
    limit: number;
  };
}

const FeedStateSchema = object({
  state: string().required(),
  errorType: string(),
  httpStatusCode: number(),
});

const GetArticleDiagnosticsOutputSchema = object({
  result: object()
    .shape({
      results: array(ArticleDiagnosticResultSchema).required(),
      total: number().required(),
      feedState: mixed<{ state: string; errorType?: string; httpStatusCode?: number }>(),
    })
    .required(),
}).required();

export type GetArticleDiagnosticsOutput = InferType<typeof GetArticleDiagnosticsOutputSchema>;

export const getArticleDiagnostics = async ({
  feedId,
  data,
}: GetArticleDiagnosticsInput): Promise<GetArticleDiagnosticsOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${feedId}/diagnose-articles`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({
        skip: data.skip,
        limit: data.limit,
      }),
    },
    validateSchema: GetArticleDiagnosticsOutputSchema,
  });

  return res as GetArticleDiagnosticsOutput;
};
