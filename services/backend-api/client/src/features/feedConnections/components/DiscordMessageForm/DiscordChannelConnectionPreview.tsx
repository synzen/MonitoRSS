import React from "react";
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
import { MentionDataProvider, useMentionData } from "../../../../contexts/MentionDataContext";

type Props = CreateDiscordChannelConnectionPreviewInput & {
  hasErrors?: boolean;
};

interface DiscordViewWithMentionsProps {
  username: string;
  avatarUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
}

const DiscordViewWithMentions: React.FC<DiscordViewWithMentionsProps> = ({
  username,
  avatarUrl,
  messages,
}) => {
  const mentionData = useMentionData();

  return (
    <DiscordView
      darkTheme
      username={username}
      avatar_url={avatarUrl}
      messages={messages}
      mentionResolvers={mentionData}
    />
  );
};

export const DiscordChannelConnectionPreview = ({
  connectionId,
  data,
  feedId,
  hasErrors,
}: Props) => {
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
    enabled: !!(feed && connection && debouncedData.article?.id && !hasErrors),
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
      <InlineErrorAlert title={useError.message} description={t("common.errors.tryAgainLater")} />
    );
  }

  return (
    <Box position="relative" borderRadius="md" overflow="hidden" isolation="isolate">
      {(isFetching || waitingForArticle) && (
        <Box
          borderRadius="md"
          position="absolute"
          width="100%"
          height="100%"
          background="rgba(0,0,0,0.75)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={8}
          textAlign="center"
          zIndex={1}
        >
          {isFetching && <Spinner />}
          {waitingForArticle && <Text>Waiting for article...</Text>}
        </Box>
      )}
      {hasErrors && (
        <Box
          borderRadius="md"
          position="absolute"
          width="100%"
          height="100%"
          background="rgba(0,0,0,0.75)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={8}
          textAlign="center"
        >
          <Text color="red.400">
            Some inputs are invalid. Please ensure all fields are valid for a preview to be
            displayed.
          </Text>
        </Box>
      )}
      <MentionDataProvider serverId={connection?.details.channel?.guildId}>
        <DiscordViewWithMentions
          username={bot?.result.username || "MonitoRSS"}
          avatarUrl={bot?.result.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
          messages={connectionPreview?.result.messages || []}
        />
      </MentionDataProvider>
    </Box>
  );
};
