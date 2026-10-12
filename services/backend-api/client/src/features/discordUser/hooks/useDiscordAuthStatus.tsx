import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getDiscordAuthStatus, GetDiscordAuthStatusOutput } from "../api";

export const useDiscordAuthStatus = () => {
  const { data, status, error } = useQuery<GetDiscordAuthStatusOutput, ApiAdapterError>({
    queryKey: ["discord-auth-status"],
    queryFn: async () => getDiscordAuthStatus(),
  });

  return {
    data,
    status,
    error,
  };
};
