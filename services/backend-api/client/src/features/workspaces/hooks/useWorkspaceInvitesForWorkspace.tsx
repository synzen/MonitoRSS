import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getWorkspaceInvites, GetWorkspaceInvitesOutput } from "../api";

interface Props {
  workspaceSlug?: string;
  enabled?: boolean;
}

export const useWorkspaceInvitesForWorkspace = ({ workspaceSlug, enabled }: Props) => {
  const { data, status, error, refetch } = useQuery<GetWorkspaceInvitesOutput, ApiAdapterError>(
    ["workspace-invites-list", { workspaceSlug }],
    async () => {
      if (!workspaceSlug) {
        throw new Error("Missing workspace selection");
      }

      return getWorkspaceInvites(workspaceSlug);
    },
    {
      enabled: enabled !== false && !!workspaceSlug,
    },
  );

  return {
    invites: data?.result,
    status,
    error,
    refetch,
  };
};
