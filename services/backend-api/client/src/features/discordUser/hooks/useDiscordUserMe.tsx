import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getDiscordMe, GetDiscordMeOutput } from "../api";
import { useDiscordAuthStatus } from "./useDiscordAuthStatus";

export const useDiscordUserMe = () => {
  const { data: authStatusData, status: authStatus, error: authError } = useDiscordAuthStatus();
  const { data, status, error, refetch } = useQuery<GetDiscordMeOutput, ApiAdapterError>(
    ["discord-user-me"],
    async () => getDiscordMe(),
    {
      enabled: !!authStatusData?.authenticated,
    }
  );

  return {
    authCheck: {
      isAuthenticated: !authStatusData ? null : !!authStatusData && authStatusData.authenticated,
      status: authStatus,
      error: authError,
    },
    data,
    status,
    error,
    refetch,
  };
};
