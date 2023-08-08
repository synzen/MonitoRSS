import { InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";

const GetUserFeedManagementInvitesCountOutputSchema = object({
  total: number().required(),
}).required();

export type GetUserFeedManagementInvitesCountOutput = InferType<
  typeof GetUserFeedManagementInvitesCountOutputSchema
>;

export const getUserFeedManagementInvitesCount =
  async (): Promise<GetUserFeedManagementInvitesCountOutput> => {
    const res = await fetchRest(`/api/v1/user-feed-management-invites/pending`, {
      validateSchema: GetUserFeedManagementInvitesCountOutputSchema,
    });

    return res as GetUserFeedManagementInvitesCountOutput;
  };
