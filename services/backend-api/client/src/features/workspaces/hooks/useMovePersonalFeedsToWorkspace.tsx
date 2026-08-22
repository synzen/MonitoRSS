import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
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
    onError: async (error) => {
      await queryClient.invalidateQueries({ queryKey: ["user-feeds"] });

      if (error.errorCode === ApiErrorCode.WORKSPACE_PERSONAL_FEED_MOVE_CAPACITY_CHANGED) {
        await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      }
    },
  });
};
