import { InferType, array, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedManagementInviteSchema } from "../types";

const GetUserFeedManagementInvitesOutputSchema = object({
  results: array(UserFeedManagementInviteSchema).required(),
}).required();

export type GetUserFeedManagementInvitesOutput = InferType<
  typeof GetUserFeedManagementInvitesOutputSchema
>;

export const getUserFeedManagementInvites =
  async (): Promise<GetUserFeedManagementInvitesOutput> => {
    const res = await fetchRest(`/api/v1/user-feed-management-invites`, {
      validateSchema: GetUserFeedManagementInvitesOutputSchema,
    });

    return res as GetUserFeedManagementInvitesOutput;
  };
