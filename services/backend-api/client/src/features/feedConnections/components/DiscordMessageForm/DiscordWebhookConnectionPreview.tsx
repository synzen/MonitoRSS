import { Box, Spinner } from "@chakra-ui/react";
import DiscordView from "../../../../components/DiscordView";
import { FeedConnectionType } from "../../../../types";
import { useUserFeed } from "../../../feed/hooks";
import { CreateDiscordWebhookConnectionPreviewInput } from "../../api";
import { useCreateConnectionPreview, useDiscordWebhookConnection } from "../../hooks";
import { useDebounce } from "../../../../hooks";

type Props = CreateDiscordWebhookConnectionPreviewInput;

export const DiscordWebhookConnectionPreview = ({ connectionId, data, feedId }: Props) => {
  const { feed, fetchStatus: feedFetchStatus } = useUserFeed({
    feedId,
  });
  const { connection, fetchStatus: connectionFetchStatus } = useDiscordWebhookConnection({
    connectionId,
    feedId,
  });
  const debouncedData = useDebounce(data, 500);

  const { data: connectionPreview, fetchStatus } = useCreateConnectionPreview(
    FeedConnectionType.DiscordWebhook,
    {
      enabled: !!(feed && connection),
      data: {
        connectionId: connection?.id as string,
        feedId,
        data: {
          splitOptions: connection?.splitOptions,
          connectionFormatOptions: connection?.details.formatter,
          userFeedFormatOptions: feed?.formatOptions,
          mentions: connection?.mentions,
          ...debouncedData,
        },
      },
    }
  );

  const isFetching =
    feedFetchStatus === "fetching" ||
    connectionFetchStatus === "fetching" ||
    fetchStatus === "fetching";

  return (
    <Box position="relative" borderRadius="md" overflow="hidden">
      {isFetching && (
        <Box
          borderRadius="md"
          position="absolute"
          width="100%"
          height="100%"
          background="rgba(0,0,0,0.75)"
          zIndex={10}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Spinner />
        </Box>
      )}
      <DiscordView
        darkTheme
        username={connection?.details.webhook.name || "Discord Bot"}
        avatar_url={
          connection?.details.webhook.iconUrl || "https://cdn.discordapp.com/embed/avatars/0.png"
        }
        messages={connectionPreview?.result.messages || []}
      />
    </Box>
  );
};
