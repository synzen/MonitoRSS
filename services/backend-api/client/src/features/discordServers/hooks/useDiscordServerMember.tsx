import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { GetServerMemberOutput, getServerMember } from "../api";

interface Props {
  serverId?: string;
  memberId?: string;
  disabled?: boolean;
}

export const useDiscordServerMember = ({ serverId, memberId, disabled }: Props) => {
  const queryKey = [
    "server-member",
    {
      serverId,
      memberId,
    },
  ];

  const { data, status, error, isFetching } = useQuery<
    GetServerMemberOutput | null,
    ApiAdapterError
  >(
    queryKey,
    async () => {
      if (!serverId || !memberId) {
        throw new Error("Missing server ID or member ID when getting server member");
      }

      return getServerMember({
        serverId,
        memberId,
      });
    },
    {
      enabled: !!serverId && !!memberId && !disabled,
    }
  );

  return {
    data,
    status,
    error,
    isFetching,
  };
};
