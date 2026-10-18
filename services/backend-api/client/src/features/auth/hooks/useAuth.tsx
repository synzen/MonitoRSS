import { DiscordUser, useDiscordUserMe } from "@/features/discordUser";
import ApiAdapterError from "@/utils/ApiAdapterError";

interface UseAuthOutput {
  status: "pending" | "idle" | "error" | "success";
  authCheckStatus: "pending" | "idle" | "error" | "success";
  discordUser?: DiscordUser;
  error?: ApiAdapterError | null;
  authenticated?: boolean;
}

export const useAuth = (): UseAuthOutput => {
  const { status, data, authCheck } = useDiscordUserMe();

  const authCheckStatus = authCheck.status;

  if (authCheck.isAuthenticated === false) {
    return {
      status,
      authCheckStatus,
      authenticated: false,
    };
  }

  if (data) {
    return {
      status,
      authCheckStatus,
      authenticated: true,
      discordUser: data,
    };
  }

  return {
    status,
    authCheckStatus,
  };
};
