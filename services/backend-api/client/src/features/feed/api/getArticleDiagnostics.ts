import { array, InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { ArticleDiagnosticResultSchema } from "../types/ArticleDiagnostics";

export interface GetArticleDiagnosticsInput {
  feedId: string;
  data: {
    skip: number;
    limit: number;
  };
}

const GetArticleDiagnosticsOutputSchema = object({
  result: object()
    .shape({
      results: array(ArticleDiagnosticResultSchema).required(),
      total: number().required(),
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
