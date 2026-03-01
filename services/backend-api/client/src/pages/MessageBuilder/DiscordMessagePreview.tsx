import React from "react";
import {
  Box,
  HStack,
  Text,
  Stack,
  Highlight,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Avatar,
  chakra,
  VisuallyHidden,
} from "@chakra-ui/react";
import { ChevronRightIcon, LockIcon } from "@chakra-ui/icons";
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
import { MentionDataProvider, useMentionData } from "../../contexts/MentionDataContext";

interface DiscordMessagePreviewProps {
  maxHeight?: string | number;
  onResolvedMessages?: (messages: Record<string, any>[]) => void;
  brandingDisplayName: string;
  brandingAvatarUrl: string;
  onBrandingDisplayNameChange: (value: string) => void;
  onBrandingAvatarUrlChange: (value: string) => void;
  webhooksAllowed: boolean;
}

interface DiscordMessageDisplayWithMentionsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  maxHeight?: string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  showVerifiedInAppBadge?: boolean;
  username?: string;
  avatarUrl?: string;
}

const DiscordMessageDisplayWithMentions: React.FC<DiscordMessageDisplayWithMentionsProps> = ({
  messages,
  maxHeight,
  isLoading,
  emptyMessage,
  showVerifiedInAppBadge,
  username,
  avatarUrl,
}) => {
  const mentionData = useMentionData();

  return (
    <DiscordMessageDisplay
      messages={messages}
      maxHeight={maxHeight}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      mentionResolvers={mentionData}
      showVerifiedInAppBadge={showVerifiedInAppBadge}
      username={username}
      avatarUrl={avatarUrl}
    />
  );
};

export const DiscordMessagePreview: React.FC<DiscordMessagePreviewProps> = ({
  maxHeight,
  onResolvedMessages,
  brandingDisplayName,
  brandingAvatarUrl,
  onBrandingDisplayNameChange,
  onBrandingAvatarUrlChange,
  webhooksAllowed,
}) => {
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
    messageComponent,
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

  React.useEffect(() => {
    onResolvedMessages?.(messages);
  }, [messages]);

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

  const brandingSummary = brandingDisplayName.trim() || "Default";

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
                  {!connection.details.channel.parentChannelId &&
                    connection.details.channel?.id && (
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
        <chakra.details
          mb={3}
          borderRadius="md"
          border="1px solid"
          borderColor="gray.600"
          bg="gray.700"
          open={!webhooksAllowed || undefined}
        >
          <chakra.summary
            px={3}
            py={2}
            cursor="pointer"
            fontSize="sm"
            fontWeight="medium"
            color="gray.300"
            _hover={{ bg: "gray.600" }}
            borderRadius="md"
            listStyleType="none"
            sx={{
              "&::-webkit-details-marker": { display: "none" },
              "&::marker": { display: "none" },
            }}
          >
            <HStack spacing={2}>
              <ChevronRightIcon
                boxSize={4}
                color="gray.400"
                transition="transform 0.15s ease"
                sx={{
                  "details[open] > summary > div > &": {
                    transform: "rotate(90deg)",
                  },
                }}
              />
              <Avatar
                size="2xs"
                src={brandingAvatarUrl || undefined}
                name={brandingDisplayName || "MonitoRSS"}
                bg="gray.500"
              />
              <Text as="span">Branding: {brandingSummary}</Text>
              {!webhooksAllowed && (
                <>
                  <LockIcon boxSize={3} color="whiteAlpha.600" aria-hidden="true" />
                  <VisuallyHidden>— requires paid plan</VisuallyHidden>
                </>
              )}
            </HStack>
          </chakra.summary>
          <Box px={3} pb={3} pt={2} borderTop="1px solid" borderColor="gray.600">
            {!webhooksAllowed && (
              <Text fontSize="xs" color="whiteAlpha.600" mb={3}>
                Free plan - preview how your branding looks, then upgrade to save it.
              </Text>
            )}
            <HStack spacing={4} flexWrap="wrap">
              <FormControl flex={1} minW="200px">
                <FormLabel fontSize="sm">Display Name</FormLabel>
                <Input
                  size="sm"
                  bg="gray.800"
                  placeholder="e.g. Gaming News"
                  value={brandingDisplayName}
                  onChange={(e) => onBrandingDisplayNameChange(e.target.value)}
                />
                <FormHelperText fontSize="xs">The name shown as the message author</FormHelperText>
              </FormControl>
              <FormControl flex={1} minW="200px">
                <FormLabel fontSize="sm">Avatar URL</FormLabel>
                <Input
                  size="sm"
                  bg="gray.800"
                  placeholder="https://example.com/avatar.png"
                  value={brandingAvatarUrl}
                  onChange={(e) => onBrandingAvatarUrlChange(e.target.value)}
                />
                <FormHelperText fontSize="xs">The avatar shown next to the message</FormHelperText>
              </FormControl>
            </HStack>
          </Box>
        </chakra.details>
        <MentionDataProvider serverId={connection.details.channel?.guildId}>
          <DiscordMessageDisplayWithMentions
            messages={messages}
            maxHeight={maxHeight}
            isLoading={isFetching || !currentArticle}
            emptyMessage={showEmptyState ? "No components added yet" : undefined}
            showVerifiedInAppBadge={!connection.details.webhook}
            username={brandingDisplayName || undefined}
            avatarUrl={brandingAvatarUrl || undefined}
          />
        </MentionDataProvider>
        <Text fontSize="sm" color="gray.400" mt={2} textAlign="left">
          This is an approximate preview. Send to Discord to see the actual representation.
        </Text>
      </PageAlertProvider>
    </Stack>
  );
};
