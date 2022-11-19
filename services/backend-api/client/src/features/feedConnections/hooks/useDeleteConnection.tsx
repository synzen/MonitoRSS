import { useMutation, useQueryClient } from '@tanstack/react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { deleteConnection, DeleteConnectionInput } from '../api';

export const useDeleteConnection = () => {
  const queryClient = useQueryClient();
  const {
    mutateAsync,
    status,
  } = useMutation<
  void,
  ApiAdapterError,
  DeleteConnectionInput
  >(
    (details) => deleteConnection(details),
    {
      onSuccess: (data, inputData) => queryClient.invalidateQueries({
        queryKey: ['user-feed', {
          feedId: inputData.feedId,
        }],
        refetchType: 'all',
      }),
    },
  );

  return {
    mutateAsync,
    status,
  };
};
