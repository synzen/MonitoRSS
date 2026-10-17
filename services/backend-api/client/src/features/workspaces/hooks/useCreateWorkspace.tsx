import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createWorkspace, CreateWorkspaceInput, CreateWorkspaceOutput } from "../api";

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    CreateWorkspaceOutput,
    ApiAdapterError,
    CreateWorkspaceInput
  >({
    mutationFn: (details) => createWorkspace(details),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces"],
        exact: false,
      });
    },
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
