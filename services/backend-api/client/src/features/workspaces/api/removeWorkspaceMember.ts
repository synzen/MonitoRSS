import fetchRest from "@/utils/fetchRest";

export interface RemoveWorkspaceMemberInput {
  workspaceSlug: string;
  userId: string;
}

export const removeWorkspaceMember = async ({
  workspaceSlug,
  userId,
}: RemoveWorkspaceMemberInput): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/members/${userId}`, {
    requestOptions: {
      method: "DELETE",
    },
    skipJsonParse: true,
  });
};
