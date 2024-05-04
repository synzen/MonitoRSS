import { array, InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedDeliveryLogSchema } from "../types";

export interface GetUserFeedDeliveryLogsInput {
  feedId: string;
  data: {
    limit: number;
    skip: number;
  };
}

const GetUserFeedDeliveryLogsOutputSchema = object({
  result: object()
    .shape({
      logs: array(UserFeedDeliveryLogSchema).required(),
    })
    .required(),
}).required();

export type GetUserFeedDeliveryLogsOutput = InferType<typeof GetUserFeedDeliveryLogsOutputSchema>;

export const getUserFeedDeliveryLogs = async ({
  feedId,
  data,
}: GetUserFeedDeliveryLogsInput): Promise<GetUserFeedDeliveryLogsOutput> => {
  const params = new URLSearchParams();

  params.append("limit", data.limit.toString());
  params.append("skip", data.skip.toString());

  const query = params.toString();

  const res = await fetchRest(`/api/v1/user-feeds/${feedId}/delivery-logs?${query}`, {
    requestOptions: {
      method: "GET",
    },
    validateSchema: GetUserFeedDeliveryLogsOutputSchema,
  });

  return res as GetUserFeedDeliveryLogsOutput;
};
