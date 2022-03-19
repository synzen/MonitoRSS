import { useQuery } from 'react-query';
import { DiscordUser, getDiscordMe } from '@/features/discordUser';
import ApiAdapterError from '@/utils/ApiAdapterError';

interface UseAuthOutput {
  status: 'loading' | 'idle' | 'error' | 'success';
  discordUser?: DiscordUser;
  error?: ApiAdapterError | null;
  authenticated?: boolean;
}

interface UseQueryOutput {
  authenticated: boolean
  discordUser?: DiscordUser
}

export const useAuth = (): UseAuthOutput => {
  const { status, data, error } = useQuery<UseQueryOutput, ApiAdapterError>('auth', async () => {
    try {
      const response = await getDiscordMe();

      return {
        authenticated: true,
        discordUser: response,
      };
    } catch (err) {
      if (err instanceof ApiAdapterError && err.statusCode === 401) {
        return {
          authenticated: false,
        };
      }

      throw err;
    }
  });

  return {
    status,
    authenticated: data?.authenticated,
    discordUser: data?.discordUser,
    error,
  };
};
