import fetchRest from "@/utils/fetchRest";

export const declineWorkspaceInvite = async (inviteId: string): Promise<void> => {
  await fetchRest(`/api/v1/workspace-invites/${inviteId}/decline`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({}),
    },
    skipJsonParse: true,
  });
};
