import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { disconnectWorkspaceReddit } from "../api";

export const useDisconnectWorkspaceReddit = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    { workspaceSlug: string }
  >(({ workspaceSlug }) => disconnectWorkspaceReddit(workspaceSlug), {
    onSuccess: (_data, { workspaceSlug }) => {
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
