import { useMutation } from 'react-query';
import ApiAdapterError from '@/utils/ApiAdapterError';
import {
  createFeedConnection,
  CreateFeedConnectionInput,
  CreateFeedConnectionOutput,
} from '../api';

export const useCreateFeedConnection = () => {
  const {
    mutateAsync,
    status,
    error,
    reset,
  } = useMutation<CreateFeedConnectionOutput, ApiAdapterError, CreateFeedConnectionInput>(
    (details) => createFeedConnection(details),
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
