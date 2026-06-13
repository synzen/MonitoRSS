import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { transferWorkspaceOwnership, TransferWorkspaceOwnershipInput } from "../api";

export const useTransferWorkspaceOwnership = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    TransferWorkspaceOwnershipInput
  >((input) => transferWorkspaceOwnership(input), {
    onSuccess: (_data, { workspaceSlug }) => {
      // The transfer flips the caller's own role (owner -> admin) as well as the
      // target's, so the workspace detail (which drives myRole and every
      // role-gated control on the settings page) and the list must refresh
      // alongside the members list.
      queryClient.invalidateQueries({ queryKey: ["workspace-members", { workspaceSlug }] });
      queryClient.invalidateQueries({ queryKey: ["workspace", { workspaceSlug }] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"], exact: false });
    },
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
