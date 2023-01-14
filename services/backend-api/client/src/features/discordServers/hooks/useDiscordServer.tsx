import { useDiscordServers } from "./useDiscordServers";

interface Props {
  serverId?: string;
}

export const useDiscordServer = ({ serverId }: Props) => {
  const { data: allServers, error, status } = useDiscordServers();

  return {
    data: allServers?.results.find((server) => server.id === serverId) || null,
    error,
    status,
  };
};
