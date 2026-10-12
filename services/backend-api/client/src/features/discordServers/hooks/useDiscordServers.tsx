import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { GetServersOutput, getServers } from "../api";

export const useDiscordServers = () => {
  const { status, error, data, refetch } = useQuery<GetServersOutput, ApiAdapterError>({
    queryKey: ["servers"],
    queryFn: async () => getServers(),
  });

  return {
    status,
    error,
    data,
    refetch,
  };
};
