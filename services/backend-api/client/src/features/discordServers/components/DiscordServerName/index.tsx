import { Text, Tooltip } from "@chakra-ui/react";
import { Loading } from "@/components";
import { useDiscordServers } from "../../hooks";

interface Props {
  serverId?: string;
  textStyle?: React.CSSProperties;
}

export const DiscordServerName = ({ serverId, textStyle }: Props) => {
  const { data, status, error } = useDiscordServers();

  const matched = data?.results.find(({ id }) => {
    return id === serverId;
  });

  if (status === "loading") {
    return <Loading size="sm" />;
  }

  if (error) {
    return (
      <Tooltip placement="bottom-start" label={`Unable to get server name (${error?.message})`}>
        <Text color="orange.500">{serverId}</Text>
      </Tooltip>
    );
  }

  return <span style={textStyle}>{matched?.name || serverId || "?"}</span>;
};
