import { UserFeedManagerStatus } from "../../../constants";
import fetchRest from "../../../utils/fetchRest";

export interface UpdateAcceptUserFeedManagementInviteInput {
  id: string;
  data: {
    status: Extract<
      UserFeedManagerStatus,
      UserFeedManagerStatus.Accepted | UserFeedManagerStatus.Declined
    >;
  };
}

export const updateAcceptUserFeedManagementInvite = async (
  options: UpdateAcceptUserFeedManagementInviteInput
): Promise<void> => {
  await fetchRest(`/api/v1/user-feed-management-invites/${options.id}/status`, {
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify(options.data),
    },
    skipJsonParse: true,
  });
};
