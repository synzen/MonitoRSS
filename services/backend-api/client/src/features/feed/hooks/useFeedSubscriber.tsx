import { useFeedSubscribers } from "./useFeedSubscribers";

interface Props {
  feedId?: string;
  subscriberId?: string;
}

export const useFeedSubscriber = ({ feedId, subscriberId }: Props) => {
  const { data, status, error } = useFeedSubscribers({
    feedId,
  });

  const subscriber = data?.results?.find((sub) => sub.id === subscriberId);

  return {
    data: subscriber,
    status,
    error,
  };
};
