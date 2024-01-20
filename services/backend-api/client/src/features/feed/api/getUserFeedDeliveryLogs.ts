import { array, InferType, object } from "yup";
import qs from "qs";
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
  const query = qs.stringify(data);

  const res = await fetchRest(`/api/v1/user-feeds/${feedId}/delivery-logs?${query}`, {
    requestOptions: {
      method: "GET",
    },
    validateSchema: GetUserFeedDeliveryLogsOutputSchema,
  });

  return res as GetUserFeedDeliveryLogsOutput;
};
