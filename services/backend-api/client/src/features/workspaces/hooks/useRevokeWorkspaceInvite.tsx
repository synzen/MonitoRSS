import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { revokeWorkspaceInvite, RevokeWorkspaceInviteInput } from "../api";

export const useRevokeWorkspaceInvite = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    RevokeWorkspaceInviteInput
  >((input) => revokeWorkspaceInvite(input), {
    onSuccess: (_data, { workspaceSlug }) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-invites-list", { workspaceSlug }] });
    },
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
