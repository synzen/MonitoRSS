import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getWorkspaceInvite, GetWorkspaceInviteOutput } from "../api";

interface Props {
  inviteId?: string;
  enabled?: boolean;
}

export const useWorkspaceInvite = ({ inviteId, enabled }: Props) => {
  const { data, status, error, refetch } = useQuery<GetWorkspaceInviteOutput, ApiAdapterError>(
    ["workspace-invite", inviteId],
    async () => getWorkspaceInvite(inviteId as string),
    {
      enabled: enabled !== false && !!inviteId,
    },
  );

  return {
    invite: data?.result,
    status,
    error,
    refetch,
  };
};
