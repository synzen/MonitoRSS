import fetchRest from '../../../utils/fetchRest';

export interface DeleteConnectionInput {
  feedId: string
  connectionId: string;
}

export const deleteConnection = async ({ connectionId, feedId }: DeleteConnectionInput) => {
  await fetchRest(`/api/v1/feeds/${feedId}/connections/${connectionId}`, {
    requestOptions: {
      method: 'DELETE',
    },
  });
};
