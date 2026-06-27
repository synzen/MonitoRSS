import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getWorkspace, GetWorkspaceOutput } from "../api";

interface Props {
  workspaceSlug?: string;
}

export const useWorkspace = ({ workspaceSlug }: Props) => {
  const { data, status, error, fetchStatus, refetch } = useQuery<
    GetWorkspaceOutput,
    ApiAdapterError | Error
  >(
    ["workspace", { workspaceSlug }],
    async () => {
      if (!workspaceSlug) {
        throw new Error("Missing workspace selection");
      }

      return getWorkspace({ workspaceSlug });
    },
    {
      enabled: !!workspaceSlug,
    },
  );

  return {
    workspace: data?.result,
    status,
    error,
    fetchStatus,
    refetch,
  };
};
