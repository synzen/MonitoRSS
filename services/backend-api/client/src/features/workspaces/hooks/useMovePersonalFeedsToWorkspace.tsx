import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { movePersonalFeedsToWorkspace, type MovePersonalFeedsToWorkspaceOutput } from "../api";

export const useMovePersonalFeedsToWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation<
    MovePersonalFeedsToWorkspaceOutput,
    ApiAdapterError,
    { workspaceSlug: string; feedIds: string[] }
  >((input) => movePersonalFeedsToWorkspace(input), {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-feeds"] });
    },
  });
};
