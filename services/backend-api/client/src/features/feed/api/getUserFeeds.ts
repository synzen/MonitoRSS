import { array, InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedComputedStatus, UserFeedDisabledCode, UserFeedSummarySchema } from "../types";

export interface GetUserFeedsInput {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: string;
  filters?: {
    computedStatuses?: UserFeedComputedStatus[];
    disabledCodes?: UserFeedDisabledCode[];
    hasConnections?: boolean;
  };
}

const GetUserFeedsOutputSchema = object({
  results: array(UserFeedSummarySchema.required()).required(),
  total: number().required(),
  feedsWithoutConnections: number().required(),
}).required();

export type GetUserFeedsOutput = InferType<typeof GetUserFeedsOutputSchema>;

export const getUserFeeds = async (options: GetUserFeedsInput): Promise<GetUserFeedsOutput> => {
  const params = new URLSearchParams();

  params.append("limit", (options.limit || 10).toString());
  params.append("offset", (options.offset || 0).toString());
  params.append("search", options.search || "");
  params.append("sort", options.sort || "");
  params.append(`filters[computedStatuses]`, options.filters?.computedStatuses?.join(",") || "");

  if (options.filters?.disabledCodes) {
    params.append(`filters[disabledCodes]`, options.filters?.disabledCodes?.join(",") || "");
  }

  if (options.filters?.hasConnections !== undefined) {
    params.append(`filters[hasConnections]`, String(options.filters.hasConnections));
  }

  const searchParams = params.toString();

  const res = await fetchRest(`/api/v1/user-feeds?${searchParams}`, {
    validateSchema: GetUserFeedsOutputSchema,
  });

  return res as GetUserFeedsOutput;
};
