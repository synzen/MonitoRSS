import fetchRest from "@/utils/fetchRest";

export interface TransferWorkspaceOwnershipInput {
  workspaceSlug: string;
  userId: string;
}

export const transferWorkspaceOwnership = async ({
  workspaceSlug,
  userId,
}: TransferWorkspaceOwnershipInput): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/members/${userId}/transfer-ownership`, {
    requestOptions: {
      method: "POST",
    },
    skipJsonParse: true,
  });
};
