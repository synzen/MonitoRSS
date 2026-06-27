import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { deleteWorkspace } from "../api";

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<void, ApiAdapterError, string>(
    (workspaceSlug) => deleteWorkspace(workspaceSlug),
    {
      onSuccess: (_data, workspaceSlug) => {
        queryClient.invalidateQueries({ queryKey: ["workspaces"], exact: false });
        // Evict (not just invalidate) the per-slug detail cache so a workspace
        // later created with the same slug cannot read the deleted workspace's
        // id from cache. That stale id would flow into checkout custom_data and
        // bill a subscription to a workspace that no longer exists.
        queryClient.removeQueries({ queryKey: ["workspace", { workspaceSlug }] });
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
