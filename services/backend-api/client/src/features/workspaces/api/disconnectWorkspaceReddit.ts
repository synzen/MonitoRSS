import fetchRest from "@/utils/fetchRest";

export const disconnectWorkspaceReddit = async (workspaceSlug: string): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/reddit-connection`, {
    requestOptions: {
      method: "DELETE",
    },
    skipJsonParse: true,
  });
};
