import { GetDiscordChannelType, useDiscordServerChannels } from "../../discordServers";

interface Props {
  serverId?: string;
  channelId?: string;
}

export const useDiscordChannelForumTags = ({ serverId, channelId }: Props) => {
  const { data, error, status } = useDiscordServerChannels({
    serverId,
    include: [GetDiscordChannelType.Forum, GetDiscordChannelType.Text],
  });

  return {
    status,
    error,
    data: data?.results.find((channel) => channel.id === channelId)?.availableTags,
  };
};
