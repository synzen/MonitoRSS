import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { removeWorkspaceMember, RemoveWorkspaceMemberInput } from "../api";

export const useRemoveWorkspaceMember = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    RemoveWorkspaceMemberInput
  >((input) => removeWorkspaceMember(input), {
    onSuccess: (_data, { workspaceSlug }) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", { workspaceSlug }] });
    },
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
