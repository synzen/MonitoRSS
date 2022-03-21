import { DiscordUser, useDiscordUserMe } from '@/features/discordUser';
import ApiAdapterError from '@/utils/ApiAdapterError';

interface UseAuthOutput {
  status: 'loading' | 'idle' | 'error' | 'success';
  discordUser?: DiscordUser;
  error?: ApiAdapterError | null;
  authenticated?: boolean;
}

export const useAuth = (): UseAuthOutput => {
  const { status, data, error } = useDiscordUserMe();

  if (error instanceof ApiAdapterError && error?.statusCode === 401) {
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
