import fetchRest from "@/utils/fetchRest";

export const leaveWorkspace = async (workspaceSlug: string): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/members/@me`, {
    requestOptions: {
      method: "DELETE",
    },
    skipJsonParse: true,
  });
};
