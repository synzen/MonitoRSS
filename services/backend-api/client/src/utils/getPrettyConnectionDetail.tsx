import { Flex } from "@chakra-ui/react";
import { DiscordChannelName, DiscordServerName } from "../features/discordServers";
import { FeedConnectionType, FeedDiscordChannelConnection } from "../types";
import getChakraColor from "./getChakraColor";

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
            color: getChakraColor("whiteAlpha.800"),
          }}
        />
      );
    }

    return (
      <Flex alignItems="center" fontSize={14} gap={1} color="whiteAlpha.800">
        <DiscordServerName
          serverId={useServerId}
          textStyle={{
            fontSize: 14,
            color: getChakraColor("whiteAlpha.800"),
          }}
        />
        <span> </span>
        <span>
          (
          <DiscordChannelName
            channelId={useChannelId}
            serverId={useServerId}
            spinnerSize="xs"
            textProps={{
              fontSize: 14,
              color: getChakraColor("whiteAlpha.800"),
            }}
          />
          )
        </span>
      </Flex>
    );
  }

  return null;
};
