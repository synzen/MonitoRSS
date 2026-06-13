import fetchRest from "@/utils/fetchRest";

export interface RevokeWorkspaceInviteInput {
  workspaceSlug: string;
  inviteId: string;
}

export const revokeWorkspaceInvite = async ({
  workspaceSlug,
  inviteId,
}: RevokeWorkspaceInviteInput): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/invites/${inviteId}`, {
    requestOptions: {
      method: "DELETE",
    },
    skipJsonParse: true,
  });
};
