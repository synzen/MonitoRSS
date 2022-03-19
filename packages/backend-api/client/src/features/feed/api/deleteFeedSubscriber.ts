import fetchRest from '../../../utils/fetchRest';

export interface DeleteFeedSubscriberInput {
  feedId: string
  subscriberId: string
}

export const deleteFeedSubscriber = async (
  options: DeleteFeedSubscriberInput,
): Promise<void> => fetchRest(
  `/api/v1/feeds/${options.feedId}/subscribers/${options.subscriberId}`,
  {
    requestOptions: {
      method: 'DELETE',
    },
  },
);
