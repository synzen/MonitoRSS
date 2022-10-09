import { useMutation } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { deleteConnection, DeleteConnectionInput } from '../api';

export const useDeleteConnection = () => {
  const {
    mutateAsync,
  } = useMutation<
  void,
  ApiAdapterError,
  DeleteConnectionInput
  >(
    (details) => deleteConnection(details),
  );

  return {
    mutateAsync,
  };
};
