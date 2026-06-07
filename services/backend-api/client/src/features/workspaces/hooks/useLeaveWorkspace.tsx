import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { leaveWorkspace } from "../api";

export const useLeaveWorkspace = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<void, ApiAdapterError, string>(
    (workspaceSlug) => leaveWorkspace(workspaceSlug),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["workspaces"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["workspace-members"], exact: false });
      },
    },
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
