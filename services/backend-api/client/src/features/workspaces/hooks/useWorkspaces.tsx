import { keepPreviousData, useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getWorkspaces, GetWorkspacesOutput } from "../api";

interface Props {
  enabled?: boolean;
}

export const useWorkspaces = (props?: Props) => {
  const { data, status, error, fetchStatus, refetch } = useQuery<
    GetWorkspacesOutput,
    ApiAdapterError
  >({
    queryKey: ["workspaces"],
    queryFn: async () => getWorkspaces(),
    enabled: props?.enabled,
    placeholderData: keepPreviousData,
  });

  return {
    workspaces: data?.result,
    status,
    error,
    fetchStatus,
    refetch,
  };
};
