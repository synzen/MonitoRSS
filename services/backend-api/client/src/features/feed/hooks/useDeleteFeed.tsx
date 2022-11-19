import { useMutation } from '@tanstack/react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  deleteFeed, DeleteFeedInput,
} from '../api';

export const useDeleteFeed = () => {
  const {
    mutateAsync,
    status,
    error,
  } = useMutation<void, ApiAdapterError, DeleteFeedInput>(
    (details) => deleteFeed(details),
  );

  return {
    mutateAsync,
    status,
    error,
  };
};
