import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { deleteWorkspace } from "../api";

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<void, ApiAdapterError, string>(
    (workspaceSlug) => deleteWorkspace(workspaceSlug),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["workspaces"], exact: false });
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
