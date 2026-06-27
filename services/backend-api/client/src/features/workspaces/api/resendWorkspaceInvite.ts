import fetchRest from "@/utils/fetchRest";

export interface ResendWorkspaceInviteInput {
  workspaceSlug: string;
  inviteId: string;
}

export const resendWorkspaceInvite = async ({
  workspaceSlug,
  inviteId,
}: ResendWorkspaceInviteInput): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/invites/${inviteId}/resend`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({}),
    },
    skipJsonParse: true,
  });
};
