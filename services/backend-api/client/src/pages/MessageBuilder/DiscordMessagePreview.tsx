import React from "react";
import { Box, HStack, Text, Stack, Highlight } from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";

import { ArticlePreviewBanner } from "./ArticlePreviewBanner";
import { useMessageBuilderContext } from "./MessageBuilderContext";
import MessageBuilderFormState from "./types/MessageBuilderFormState";
import { PageAlertContextOutlet, PageAlertProvider } from "../../contexts/PageAlertContext";
import { useCreateConnectionPreview } from "../../features/feedConnections/hooks";
import { FeedConnectionType, FeedDiscordChannelConnection } from "../../types";
import { useDebounce } from "../../hooks";
import { InlineErrorAlert, DiscordMessageDisplay } from "../../components";
import convertMessageBuilderStateToConnectionPreviewInput, {
  V2_COMPONENT_TYPE,
} from "./utils/convertMessageBuilderStateToConnectionPreviewInput";
import { useUserFeedConnectionContext } from "../../contexts/UserFeedConnectionContext";
import { DiscordServerName, DiscordChannelName } from "../../features/discordServers";
import { CreateDiscordChannelConnectionPreviewInput } from "../../features/feedConnections/api";

interface DiscordMessagePreviewProps {
  maxHeight?: string | number;
}

export const DiscordMessagePreview: React.FC<DiscordMessagePreviewProps> = ({ maxHeight }) => {
  const {
    watch,
    formState: { isValid, isDirty },
  } = useFormContext<MessageBuilderFormState>();
  const messageComponent = watch("messageComponent");
  const { currentArticle } = useMessageBuilderContext();
  const { connection, userFeed } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();

  const previewData = convertMessageBuilderStateToConnectionPreviewInput(
    userFeed,
    connection,
    messageComponent
  );

  const debouncedPreviewData = useDebounce(previewData, 500);

  const hasEmptyTextContent = React.useMemo(() => {
    type V2Component = NonNullable<
      CreateDiscordChannelConnectionPreviewInput["data"]["componentsV2"]
    >[number];

    const checkComponents = (components: V2Component[] | null | undefined): boolean => {
      if (!components || !Array.isArray(components)) return false;

      return components.some((comp) => {
        if (comp.type === V2_COMPONENT_TYPE.TextDisplay && !comp.content) return true;

        if (
          comp.type === V2_COMPONENT_TYPE.Section &&
          comp.components?.some((c) => c.type === V2_COMPONENT_TYPE.TextDisplay && !c.content)
        ) {
          return true;
        }

        if (comp.components) return checkComponents(comp.components as V2Component[]);

        return false;
      });
    };

    return checkComponents(debouncedPreviewData.componentsV2);
  }, [debouncedPreviewData]);

  const {
    data: connectionPreview,
    fetchStatus,
    error,
  } = useCreateConnectionPreview(FeedConnectionType.DiscordChannel, {
    enabled: !!currentArticle?.id && isValid && !hasEmptyTextContent,
    data: {
      connectionId: connection.id,
      feedId: userFeed.id,
      data: {
        article: {
          id: currentArticle?.id || "",
        },
        ...debouncedPreviewData,
      },
    },
  });

  const isFetching = fetchStatus === "fetching";
  const messages = connectionPreview?.result.messages || [];
  const showEmptyState =
    currentArticle &&
    messages.length === 0 &&
    !!messageComponent &&
    messageComponent.children.length === 0;

  if (error) {
    return (
      <Stack spacing={0}>
        <PageAlertProvider>
          <ArticlePreviewBanner />
          <PageAlertContextOutlet
            containerProps={{
              mb: 2,
              mt: -2,
              zIndex: 0,
            }}
          />
          <InlineErrorAlert title="Failed to load preview." description={error.message} />
        </PageAlertProvider>
      </Stack>
    );
  }

  return (
    <Stack spacing={0}>
      <PageAlertProvider>
        <ArticlePreviewBanner />
        <PageAlertContextOutlet
          containerProps={{
            mb: 2,
            mt: -2,
            zIndex: 0,
          }}
        />
        <HStack mb={2} flexWrap="wrap">
          <Text fontSize="sm" color="gray.400" fontWeight="medium">
            Previewing in{" "}
            <Box as="span" color="gray.300">
              {connection.details.channel?.guildId ? (
                <>
                  <DiscordServerName
                    serverId={connection.details.channel?.guildId}
                    textStyle={{ fontSize: "sm", fontWeight: "medium" }}
                  />
                  {!connection.details.channel.parentChannelId && connection.details.channel?.id && (
                    <>
                      {" → Channel: "}
                      <DiscordChannelName
                        channelId={connection.details.channel?.id}
                        serverId={connection.details.channel?.guildId}
                        textProps={{ fontSize: "sm", fontWeight: "medium" }}
                      />
                    </>
                  )}
                </>
              ) : (
                "Unknown Server"
              )}
            </Box>
          </Text>
          {isDirty && (
            <Text fontSize="sm" fontWeight={600}>
              <Highlight
                query="You are previewing unsaved changes"
                styles={{
                  bg: "orange.200",
                  rounded: "full",
                  px: "2",
                  py: "1",
                }}
              >
                You are previewing unsaved changes
              </Highlight>
            </Text>
          )}
        </HStack>
        <DiscordMessageDisplay
          messages={messages}
          maxHeight={maxHeight}
          isLoading={isFetching || !currentArticle}
          emptyMessage={showEmptyState ? "No components added yet" : undefined}
        />
        <Text fontSize="sm" color="gray.400" mt={2} textAlign="left">
          This is an approximate preview. Send to Discord to see the actual representation.
        </Text>
      </PageAlertProvider>
    </Stack>
  );
};
