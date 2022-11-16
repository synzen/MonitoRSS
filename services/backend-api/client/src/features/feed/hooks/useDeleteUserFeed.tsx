import { useMutation } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { deleteUserFeed, DeleteUserFeedInput } from '../api';

export const useDeleteUserFeed = () => {
  const {
    mutateAsync,
    status,
    error,
  } = useMutation<void, ApiAdapterError, DeleteUserFeedInput>(
    (details) => deleteUserFeed(details),
  );

  return {
    mutateAsync,
    status,
    error,
  };
};
