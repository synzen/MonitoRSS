import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getMyWorkspaceInvites, GetMyWorkspaceInvitesOutput } from "../api";

interface Props {
  enabled?: boolean;
}

export const useMyWorkspaceInvites = (props?: Props) => {
  const { data, status, error, refetch } = useQuery<GetMyWorkspaceInvitesOutput, ApiAdapterError>(
    ["workspace-invites", "@me"],
    async () => getMyWorkspaceInvites(),
    {
      enabled: props?.enabled,
    },
  );

  return {
    invites: data?.result,
    status,
    error,
    refetch,
  };
};
