import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { acceptWorkspaceInvite, AcceptWorkspaceInviteOutput } from "../api";

export const useAcceptWorkspaceInvite = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    AcceptWorkspaceInviteOutput,
    ApiAdapterError,
    string
  >(
    (inviteId) => acceptWorkspaceInvite(inviteId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["workspaces"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["workspace-invites"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["workspace-invite"], exact: false });
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
