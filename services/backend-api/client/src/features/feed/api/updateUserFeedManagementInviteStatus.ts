import { UserFeedManagerStatus } from "../../../constants";
import fetchRest from "../../../utils/fetchRest";

export interface UpdateUserFeedManagementInviteStatusInput {
  id: string;
  data: {
    status: Extract<
      UserFeedManagerStatus,
      UserFeedManagerStatus.Accepted | UserFeedManagerStatus.Declined
    >;
  };
}

export const updateUserFeedManagementInviteStatus = async (
  options: UpdateUserFeedManagementInviteStatusInput,
): Promise<void> => {
  await fetchRest(`/api/v1/user-feed-management-invites/${options.id}/status`, {
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify(options.data),
    },
    skipJsonParse: true,
  });
};
