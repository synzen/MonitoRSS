import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getWorkspaces, GetWorkspacesOutput } from "../api";

interface Props {
  enabled?: boolean;
}

export const useWorkspaces = (props?: Props) => {
  const { data, status, error, fetchStatus, refetch } = useQuery<GetWorkspacesOutput, ApiAdapterError>(
    ["workspaces"],
    async () => getWorkspaces(),
    {
      enabled: props?.enabled,
      keepPreviousData: true,
    },
  );

  return {
    workspaces: data?.result,
    status,
    error,
    fetchStatus,
    refetch,
  };
};
