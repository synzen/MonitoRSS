import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createWorkspaceTag,
  getWorkspaceTags,
  type CreateWorkspaceTagInput,
  type CreateWorkspaceTagOutput,
  type GetWorkspaceTagsOutput,
} from "./api";
import {
  filterWorkspaceTagIdsByCatalog,
  readWorkspaceTagFilter,
  writeWorkspaceTagFilter,
} from "./tagFilterUrl";
import type { WorkspaceTag } from "./types";

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

export function useWorkspaceTagFilter(workspaceSlug?: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tagsQuery = useWorkspaceTags(workspaceSlug);
  const requestedTagIds = useMemo(() => readWorkspaceTagFilter(searchParams), [searchParams]);
  const availableTags = tagsQuery.data?.results ?? [];
  const selectedTagIds =
    workspaceSlug && tagsQuery.status === "success"
      ? filterWorkspaceTagIdsByCatalog(requestedTagIds, availableTags)
      : [];

  useEffect(() => {
    if (!workspaceSlug || tagsQuery.status !== "success") {
      return;
    }

    const next = writeWorkspaceTagFilter(searchParams, selectedTagIds);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedTagIds, setSearchParams, tagsQuery.status, workspaceSlug]);

  const onChange = useCallback(
    (tagIds: string[]) => {
      setSearchParams((previous) => writeWorkspaceTagFilter(previous, tagIds));
    },
    [setSearchParams],
  );

  return {
    availableTags: availableTags as WorkspaceTag[],
    selectedTagIds,
    onChange,
    status: workspaceSlug ? tagsQuery.status : "success",
    error: workspaceSlug ? tagsQuery.error : null,
    refetch: tagsQuery.refetch,
  };
}
