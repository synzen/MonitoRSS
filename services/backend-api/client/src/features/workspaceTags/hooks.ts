import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createWorkspaceTag,
  getWorkspaceTags,
  type CreateWorkspaceTagInput,
  type CreateWorkspaceTagOutput,
  type GetWorkspaceTagsOutput,
} from "./api";

export function useWorkspaceTags(workspaceSlug?: string) {
  return useQuery<GetWorkspaceTagsOutput, ApiAdapterError>(
    ["workspace-tags", { workspaceSlug }],
    async () => {
      if (!workspaceSlug) {
        throw new Error("Missing Team selection");
      }

      return getWorkspaceTags(workspaceSlug);
    },
    { enabled: !!workspaceSlug },
  );
}

export function useCreateWorkspaceTag(workspaceSlug?: string) {
  const queryClient = useQueryClient();

  return useMutation<CreateWorkspaceTagOutput, ApiAdapterError, CreateWorkspaceTagInput>(
    (input) => createWorkspaceTag(input),
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["workspace-tags", { workspaceSlug }],
          exact: true,
        });
      },
    },
  );
}
