import { useMutation, useQueryClient } from '@tanstack/react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { deleteUserFeed, DeleteUserFeedInput } from '../api';

export const useDeleteUserFeed = () => {
  const queryClient = useQueryClient();

  const {
    mutateAsync,
    status,
    error,
  } = useMutation<
  void,
  ApiAdapterError,
  DeleteUserFeedInput
  >((details) => deleteUserFeed(details), {
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ['user-feeds'],
      refetchType: 'all',
      exact: false,
    }, {
      throwOnError: true,
    }),
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
