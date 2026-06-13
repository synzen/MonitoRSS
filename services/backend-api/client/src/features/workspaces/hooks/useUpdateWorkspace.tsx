import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { updateWorkspace, UpdateWorkspaceInput, UpdateWorkspaceOutput } from "../api";

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    UpdateWorkspaceOutput,
    ApiAdapterError,
    UpdateWorkspaceInput
  >((input) => updateWorkspace(input), {
    onSuccess: (_data, { workspaceSlug }) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["workspace", { workspaceSlug }] });
    },
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
