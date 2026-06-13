import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getWorkspaceMembers, GetWorkspaceMembersOutput } from "../api";

interface Props {
  workspaceSlug?: string;
  enabled?: boolean;
}

export const useWorkspaceMembers = ({ workspaceSlug, enabled }: Props) => {
  const { data, status, error, refetch } = useQuery<GetWorkspaceMembersOutput, ApiAdapterError>(
    ["workspace-members", { workspaceSlug }],
    async () => {
      if (!workspaceSlug) {
        throw new Error("Missing workspace selection");
      }

      return getWorkspaceMembers(workspaceSlug);
    },
    {
      enabled: enabled !== false && !!workspaceSlug,
    },
  );

  return {
    members: data?.result,
    status,
    error,
    refetch,
  };
};
