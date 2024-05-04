import { array, InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedRequestSchema } from "../types";

export interface GetUserFeedRequestsInput {
  feedId: string;
  data: {
    limit: number;
    skip: number;
  };
}

const GetUserFeedRequestsOutputSchema = object({
  result: object()
    .shape({
      requests: array(UserFeedRequestSchema).required(),
      nextRetryTimestamp: number().nullable().default(null),
    })
    .required(),
}).required();

export type GetUserFeedRequestsOutput = InferType<typeof GetUserFeedRequestsOutputSchema>;

export const getUserFeedRequests = async ({
  feedId,
  data,
}: GetUserFeedRequestsInput): Promise<GetUserFeedRequestsOutput> => {
  const params = new URLSearchParams();

  params.append("limit", data.limit.toString());
  params.append("skip", data.skip.toString());

  const query = params.toString();

  const res = await fetchRest(`/api/v1/user-feeds/${feedId}/requests?${query}`, {
    requestOptions: {
      method: "GET",
    },
    validateSchema: GetUserFeedRequestsOutputSchema,
  });

  return res as GetUserFeedRequestsOutput;
};
