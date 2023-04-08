import { DiscordUser, useDiscordAuthStatus, useDiscordUserMe } from "@/features/discordUser";
import ApiAdapterError from "@/utils/ApiAdapterError";

interface UseAuthOutput {
  status: "loading" | "idle" | "error" | "success";
  discordUser?: DiscordUser;
  error?: ApiAdapterError | null;
  authenticated?: boolean;
}

export const useAuth = (): UseAuthOutput => {
  const { data: authStatusData } = useDiscordAuthStatus();
  const { status, data } = useDiscordUserMe({
    enabled: !!authStatusData && authStatusData.authenticated,
  });

  if (authStatusData && !authStatusData.authenticated) {
    return {
      status,
      authenticated: false,
    };
  }

  if (data) {
    return {
      status,
      authenticated: true,
      discordUser: data,
    };
  }

  return {
    status,
  };
};
