import fetchRest from "@/utils/fetchRest";

export const deleteWorkspace = async (workspaceSlug: string): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}`, {
    requestOptions: {
      method: "DELETE",
    },
    skipJsonParse: true,
  });
};
