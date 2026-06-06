import { Flex } from "@chakra-ui/react";
import { DiscordChannelName, DiscordServerName } from "@/features/discordServers";
import { FeedConnectionType, FeedDiscordChannelConnection } from "@/types";

export const getPrettyConnectionDetail = (connection: FeedDiscordChannelConnection) => {
  const { key } = connection;

  if (key === FeedConnectionType.DiscordChannel) {
    const casted = connection as FeedDiscordChannelConnection;

    const useServerId = casted.details.channel?.guildId || casted.details.webhook?.guildId;
    const useChannelId = casted.details.channel?.id || casted.details.webhook?.channelId;

    if ((casted.details.channel && casted.details.channel.type === "thread") || !useChannelId) {
      return (
        <DiscordServerName
          serverId={useServerId}
          textStyle={{
            fontSize: 14,
            color: "var(--app-fg)",
          }}
        />
      );
    }

    return (
      <Flex alignItems="center" fontSize={14} gap={1} color="fg">
        <DiscordServerName
          serverId={useServerId}
          textStyle={{
            fontSize: 14,
            color: "var(--app-fg)",
          }}
        />
        <span> </span>
        <span>
          (
          <DiscordChannelName
            channelId={useChannelId}
            serverId={useServerId}
            textProps={{
              fontSize: 14,
              color: "var(--app-fg)",
            }}
          />
          )
        </span>
      </Flex>
    );
  }

  return null;
};
