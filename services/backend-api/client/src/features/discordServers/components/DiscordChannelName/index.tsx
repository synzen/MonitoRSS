/* eslint-disable react/jsx-no-useless-fragment */
import { useMemo } from "react";
import { SpinnerProps, Text, TextProps, Tooltip, chakra } from "@chakra-ui/react";
import { Loading } from "@/components";
import { useDiscordServerChannels } from "../../hooks";
import { GetDiscordChannelType } from "../../constants";

interface Props {
  serverId?: string;
  channelId: string;
  spinnerSize?: SpinnerProps["size"];
  textProps?: TextProps;
  parenthesis?: boolean;
  hidden?: boolean;
}

export const DiscordChannelName: React.FC<Props> = ({
  serverId,
  channelId,
  spinnerSize,
  textProps,
  parenthesis,
  hidden,
}) => {
  const { data, status, error } = useDiscordServerChannels({
    serverId,
    types: [
      GetDiscordChannelType.Forum,
      GetDiscordChannelType.Announcement,
      GetDiscordChannelType.Text,
    ],
  });
  const channelNamesById = useMemo(() => {
    const map = new Map<string, string>();

    if (data?.results) {
      data.results.forEach((channel) => {
        map.set(channel.id, channel.name);
      });
    }

    return map;
  }, [data]);

  if (hidden) {
    return null;
  }

  if (status === "loading") {
    return (
      <span>
        <Loading size={spinnerSize || "sm"} />
      </span>
    );
  }

  if (error) {
    return (
      <Tooltip
        placement="bottom-start"
        label={`Unable to get channel name (${error?.message})`}
        display="inline"
      >
        <Text color="orange.500" display="inline">
          ID: {channelId}
        </Text>
      </Tooltip>
    );
  }

  const channelName = channelNamesById.get(channelId) || channelId;

  const useName = parenthesis ? `(#${channelName})` : `#${channelName}`;

  return (
    <span>
      <chakra.a
        _hover={{
          textDecoration: "underline",
        }}
        href={`https://discord.com/channels/${serverId}/${channelId}`}
        target="_blank"
        rel="noreferrer"
      >
        <chakra.span display="inline" {...textProps}>
          {useName}
        </chakra.span>
      </chakra.a>
    </span>
  );
};
