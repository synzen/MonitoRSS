import { Box, Spinner, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import DiscordView from "../../../../components/DiscordView";
import { FeedConnectionType } from "../../../../types";
import { useUserFeed } from "../../../feed/hooks";
import { CreateDiscordChannelConnectionPreviewInput } from "../../api";
import { useCreateConnectionPreview, useDiscordChannelConnection } from "../../hooks";
import { useDebounce } from "../../../../hooks";
import { useDiscordBot } from "../../../discordUser";
import { InlineErrorAlert } from "../../../../components";

type Props = CreateDiscordChannelConnectionPreviewInput;

export const DiscordChannelConnectionPreview = ({ connectionId, data, feedId }: Props) => {
  const {
    feed,
    fetchStatus: feedFetchStatus,
    error: feedError,
  } = useUserFeed({
    feedId,
  });
  const {
    connection,
    fetchStatus: connectionFetchStatus,
    error: connectionError,
  } = useDiscordChannelConnection({
    connectionId,
    feedId,
  });
  const debouncedData = useDebounce(data, 500);

  const {
    data: connectionPreview,
    fetchStatus,
    error,
  } = useCreateConnectionPreview(FeedConnectionType.DiscordChannel, {
    enabled: !!(feed && connection && debouncedData.article?.id),
    data: {
      connectionId: connection?.id || "",
      feedId,
      data: {
        splitOptions: connection?.splitOptions,
        connectionFormatOptions: connection?.details.formatter,
        userFeedFormatOptions: feed?.formatOptions,
        mentions: connection?.mentions,
        ...connection?.details,
        ...debouncedData,
      },
    },
  });
  const { data: bot } = useDiscordBot();
  const { t } = useTranslation();

  const isFetching =
    feedFetchStatus === "fetching" ||
    connectionFetchStatus === "fetching" ||
    fetchStatus === "fetching";

  const waitingForArticle = feed && connection && !debouncedData.article?.id && !isFetching;

  const useError = feedError || connectionError || error;

  if (useError) {
    return (
      <InlineErrorAlert
        title={t("common.errors.somethingWentWrong")}
        description={useError.message}
      />
    );
  }

  return (
    <Box position="relative" borderRadius="md" overflow="hidden" zIndex={10}>
      {(isFetching || waitingForArticle) && (
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
          {isFetching && <Spinner />}
          {waitingForArticle && <Text>Waiting for article...</Text>}
        </Box>
      )}
      <DiscordView
        darkTheme
        username={bot?.result.username || "MonitoRSS"}
        avatar_url={bot?.result.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
        messages={connectionPreview?.result.messages || []}
      />
    </Box>
  );
};
