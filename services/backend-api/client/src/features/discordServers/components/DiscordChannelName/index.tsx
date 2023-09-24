/* eslint-disable react/jsx-no-useless-fragment */
import { useMemo } from "react";
import { SpinnerProps, Text, TextProps, Tooltip } from "@chakra-ui/react";
import { Loading } from "@/components";
import { useDiscordServerChannels } from "../../hooks";
import { GetDiscordChannelType } from "../../constants";

interface Props {
  serverId?: string;
  channelId: string;
  spinnerSize?: SpinnerProps["size"];
  textProps?: TextProps;
  parenthesis?: boolean;
}

export const DiscordChannelName: React.FC<Props> = ({
  serverId,
  channelId,
  spinnerSize,
  textProps,
  parenthesis,
}) => {
  const { data, status, error } = useDiscordServerChannels({
    serverId,
    include: [
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

  if (status === "loading") {
    return <Loading size={spinnerSize || "sm"} />;
  }

  if (error) {
    return (
      <Tooltip placement="bottom-start" label={`Unable to get channel name (${error?.message})`}>
        <Text color="orange.500">{channelId}</Text>
      </Tooltip>
    );
  }

  const channelName = channelNamesById.get(channelId) || channelId;

  const useName = parenthesis ? `(#${channelName})` : `#${channelName}`;

  return (
    <Text display="inline" {...textProps}>
      {useName}
    </Text>
  );
};
