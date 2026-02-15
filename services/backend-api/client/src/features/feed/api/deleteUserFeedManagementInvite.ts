import fetchRest from "../../../utils/fetchRest";

export interface DeleteUserFeedManagementInviteInput {
  id: string;
}

export const deleteUserFeedManagementInvite = async (
  options: DeleteUserFeedManagementInviteInput,
): Promise<void> => {
  await fetchRest(`/api/v1/user-feed-management-invites/${options.id}`, {
    requestOptions: {
      method: "DELETE",
    },
    skipJsonParse: true,
  });
};
