import { useUserFeed } from "../../feed/hooks";

interface Props {
  feedId?: string;
  connectionId?: string;
}

export const useConnection = ({ feedId, connectionId }: Props) => {
  const { feed, status, error, fetchStatus } = useUserFeed({
    feedId,
  });

  const connection = feed?.connections.find((c) => c.id === connectionId);

  return {
    connection,
    status,
    error,
    fetchStatus,
  };
};
