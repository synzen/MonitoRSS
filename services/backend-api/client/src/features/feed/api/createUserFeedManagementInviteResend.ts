import fetchRest from "../../../utils/fetchRest";

export interface CreateUserFeedManagementInviteResendInput {
  id: string;
}

export const createUserFeedManagementInviteResend = async (
  options: CreateUserFeedManagementInviteResendInput,
): Promise<void> => {
  await fetchRest(`/api/v1/user-feed-management-invites/${options.id}/resend`, {
    skipJsonParse: true,
    requestOptions: {
      method: "POST",
      body: JSON.stringify({}),
    },
  });
};
