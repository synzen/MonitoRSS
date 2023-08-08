import { UserFeedManagerStatus } from "../../../constants";
import fetchRest from "../../../utils/fetchRest";

export interface UpdateUserFeedManagementInviteInput {
  id: string;
  data: {
    status: Extract<
      UserFeedManagerStatus,
      UserFeedManagerStatus.Accepted | UserFeedManagerStatus.Declined
    >;
  };
}

export const updateUserFeedManagementInvite = async (
  options: UpdateUserFeedManagementInviteInput
): Promise<void> => {
  await fetchRest(`/api/v1/user-feed-management-invites/${options.id}`, {
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify(options.data),
    },
    skipJsonParse: true,
  });
};
