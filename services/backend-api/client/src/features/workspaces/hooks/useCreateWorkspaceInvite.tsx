import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createWorkspaceInvite,
  CreateWorkspaceInviteInput,
  CreateWorkspaceInviteOutput,
} from "../api";

export const useCreateWorkspaceInvite = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    CreateWorkspaceInviteOutput,
    ApiAdapterError,
    CreateWorkspaceInviteInput
  >((input) => createWorkspaceInvite(input), {
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
