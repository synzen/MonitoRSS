import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { declineWorkspaceInvite } from "../api";

export const useDeclineWorkspaceInvite = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<void, ApiAdapterError, string>(
    (inviteId) => declineWorkspaceInvite(inviteId),
    {
      onSuccess: () => {
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
