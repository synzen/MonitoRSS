import { useQuery } from 'react-query';
import { getFeeds, GetFeedsOutput } from '../api';
import ApiAdapterError from '../../../utils/ApiAdapterError';

interface Props {
  serverId?: string
}

export const useFeeds = ({ serverId }: Props) => {
  const { data, status, error } = useQuery<GetFeedsOutput, ApiAdapterError>(
    ['feeds', { serverId }],
    async () => {
      if (!serverId) {
        throw new Error('Missing server ID when getting feeds');
      }

      return getFeeds({
        serverId,
      });
    },
    {
      enabled: !!serverId,
    },
  );

  return {
    data,
    status,
    error,
  };
};
