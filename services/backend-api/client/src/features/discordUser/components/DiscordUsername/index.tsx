import { Spinner } from "@chakra-ui/react";
import { useDiscordUser } from "../../hooks";

interface Props {
  userId: string;
}

export const DiscordUsername = ({ userId }: Props) => {
  const { data: userData, isFetching: isFetchingUser } = useDiscordUser({
    userId,
  });

  if (isFetchingUser) {
    return <Spinner size="sm" />;
  }

  const username = userData?.result.username;

  if (!username) {
    return <span>{userId}</span>;
  }

  return <span>{username}</span>;
};
