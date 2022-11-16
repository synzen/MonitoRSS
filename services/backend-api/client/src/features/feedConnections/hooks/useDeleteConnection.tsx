import { useMutation } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { deleteConnection, DeleteConnectionInput } from '../api';

export const useDeleteConnection = () => {
  const {
    mutateAsync,
    status,
  } = useMutation<
  void,
  ApiAdapterError,
  DeleteConnectionInput
  >(
    (details) => deleteConnection(details),
  );

  return {
    mutateAsync,
    status,
  };
};
