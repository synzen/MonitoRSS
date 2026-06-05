import React from "react";
import { Box, HStack, Text, Stack, Input, Icon, chakra, VisuallyHidden } from "@chakra-ui/react";
import { FaChevronRight, FaLock } from "react-icons/fa6";
import { Avatar } from "@/components/ui/avatar";
import { Field } from "@/components/ui/field";
import { ArticlePreviewBanner } from "./ArticlePreviewBanner";
import { useMessageBuilderContext } from "./MessageBuilderContext";
import { useMessageBuilderStateContext } from "./state";
import { PageAlertContextOutlet, PageAlertProvider } from "@/contexts/PageAlertContext";
import { useCreateConnectionPreview } from "../connection/hooks";
import { FeedConnectionType, FeedDiscordChannelConnection } from "@/types";
import { useDebounce } from "@/hooks";
import { useDiscordBot } from "@/features/discordUser";
import { InlineErrorAlert, UnsavedChangesBadge } from "@/components";
import {
  DiscordMessageDisplay,
  resolvePreviewAvatarUrl,
} from "../shared/components/DiscordMessageDisplay";
import convertMessageBuilderStateToConnectionPreviewInput, {
  V2_COMPONENT_TYPE,
} from "./utils/convertMessageBuilderStateToConnectionPreviewInput";
import { useUserFeedConnectionContext } from "@/features/feed";
import { DiscordServerName, DiscordChannelName } from "@/features/discordServers";
import { CreateDiscordChannelConnectionPreviewInput } from "../connection/api";
import { MentionDataProvider, useMentionData } from "../shared/contexts/MentionDataContext";

interface DiscordMessagePreviewProps {
  maxHeight?: string | number;
  onResolvedMessages?: (messages: Record<string, any>[]) => void;
  brandingDisplayName: string;
  brandingAvatarUrl: string;
  onBrandingDisplayNameChange: (value: string) => void;
  onBrandingAvatarUrlChange: (value: string) => void;
  webhooksAllowed: boolean;
  brandingChanged: boolean;
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

const emptyMessages: any[] = [];

export const DiscordMessagePreview: React.FC<DiscordMessagePreviewProps> = ({
  maxHeight,
  onResolvedMessages,
  brandingDisplayName,
  brandingAvatarUrl,
  onBrandingDisplayNameChange,
  onBrandingAvatarUrlChange,
  webhooksAllowed,
  brandingChanged,
}) => {
  const { messageComponent, isDirty, errors } = useMessageBuilderStateContext();
  const { currentArticle } = useMessageBuilderContext();
  const { connection, userFeed } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { data: bot } = useDiscordBot();

  const previewData = convertMessageBuilderStateToConnectionPreviewInput(
    userFeed,
    connection,
    messageComponent,
  );

  const { value: debouncedPreviewData, pending: previewDataIsDebouncing } = useDebounce(
    previewData,
    500,
    { trackPending: true },
  );

  const hasValidationErrors =
    errors.messageComponent != null && Object.keys(errors.messageComponent).length > 0;

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
    enabled:
      !!currentArticle?.id &&
      !hasEmptyTextContent &&
      !hasValidationErrors &&
      !previewDataIsDebouncing,
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
  const messages = connectionPreview?.result.messages ?? emptyMessages;
  // Google Translate wraps text nodes in <font> elements, which breaks React's
  // DOM reconciliation. Keying on a version counter forces a full remount when
  // new preview data arrives, creating fresh DOM nodes instead of patching
  // translated ones that React can no longer update.
  const prevMessagesRef = React.useRef(messages);
  const previewVersionRef = React.useRef(0);

  if (messages !== prevMessagesRef.current) {
    prevMessagesRef.current = messages;
    previewVersionRef.current += 1;
  }

  const showEmptyState =
    currentArticle &&
    messages.length === 0 &&
    !!messageComponent &&
    messageComponent.children.length === 0;

  React.useEffect(() => {
    onResolvedMessages?.(messages);
  }, [messages]);

  if (error && !hasValidationErrors && !previewDataIsDebouncing) {
    return (
      <Stack gap={0}>
        <PageAlertProvider>
          <ArticlePreviewBanner
            brandingDisplayName={brandingDisplayName}
            brandingAvatarUrl={brandingAvatarUrl}
          />
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

  const resolvedAvatarUrl = resolvePreviewAvatarUrl({
    brandingAvatarUrl,
    brandingDisplayName,
    botAvatarUrl: bot?.result.avatar,
  });
  const brandingSummary = brandingDisplayName.trim() || "Default";

  return (
    <Stack gap={0}>
      <PageAlertProvider>
        <ArticlePreviewBanner
          brandingDisplayName={brandingDisplayName}
          brandingAvatarUrl={brandingAvatarUrl}
        />
        <PageAlertContextOutlet
          containerProps={{
            mb: 2,
            mt: -2,
            zIndex: 0,
          }}
        />
        <HStack mb={2} flexWrap="wrap">
          <Text fontSize="sm" color="fg.muted" fontWeight="medium">
            Previewing in{" "}
            <Box as="span" color="fg">
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
          {(isDirty || brandingChanged) && (
            <UnsavedChangesBadge label="You are previewing unsaved changes" />
          )}
        </HStack>
        <chakra.details
          mb={3}
          borderRadius="md"
          border="1px solid"
          borderColor="border"
          bg="bg.subtle"
          open={!webhooksAllowed || undefined}
        >
          <chakra.summary
            px={3}
            py={2}
            cursor="pointer"
            fontSize="sm"
            fontWeight="medium"
            color="fg.muted"
            _hover={{ bg: "bg.emphasized" }}
            borderRadius="md"
            listStyleType="none"
            css={{
              "&::-webkit-details-marker": { display: "none" },
              "&::marker": { display: "none" },
            }}
          >
            <HStack gap={2}>
              <Icon
                as={FaChevronRight}
                boxSize={4}
                color="fg.muted"
                transition="transform 0.15s ease"
                css={{
                  "details[open] > summary > div > &": {
                    transform: "rotate(90deg)",
                  },
                }}
              />
              <Avatar size="2xs" src={resolvedAvatarUrl} bg="bg.emphasized" />
              <Text as="span">Branding: {brandingSummary}</Text>
              {!webhooksAllowed && (
                <>
                  <Icon as={FaLock} boxSize={3} color="fg.muted" aria-hidden="true" />
                  <VisuallyHidden>— requires paid plan</VisuallyHidden>
                </>
              )}
            </HStack>
          </chakra.summary>
          <Box px={3} pb={3} pt={2} borderTop="1px solid" borderColor="border">
            {!webhooksAllowed && (
              <Text fontSize="xs" color="fg.muted" mb={3}>
                Upgrade to customize your branding. Preview it here first!
              </Text>
            )}
            <HStack gap={4} flexWrap="wrap">
              <Field
                flex={1}
                minW="200px"
                label={<Text fontSize="sm">Display Name</Text>}
                helperText={<Text fontSize="xs">The name shown as the message author</Text>}
              >
                <Input
                  size="sm"
                  placeholder="e.g. Gaming News"
                  value={brandingDisplayName}
                  onChange={(e) => onBrandingDisplayNameChange(e.target.value)}
                />
              </Field>
              <Field
                flex={1}
                minW="200px"
                label={<Text fontSize="sm">Avatar URL</Text>}
                helperText={<Text fontSize="xs">The avatar shown next to the message</Text>}
              >
                <Input
                  size="sm"
                  placeholder="https://example.com/avatar.png"
                  value={brandingAvatarUrl}
                  onChange={(e) => onBrandingAvatarUrlChange(e.target.value)}
                />
              </Field>
            </HStack>
          </Box>
        </chakra.details>
        <MentionDataProvider serverId={connection.details.channel?.guildId}>
          <DiscordMessageDisplayWithMentions
            key={previewVersionRef.current}
            messages={messages}
            maxHeight={maxHeight}
            isLoading={isFetching || !currentArticle}
            emptyMessage={showEmptyState ? "No components added yet" : undefined}
            showVerifiedInAppBadge={!connection.details.webhook}
            username={brandingDisplayName || undefined}
            avatarUrl={resolvedAvatarUrl}
          />
        </MentionDataProvider>
        <Text fontSize="sm" color="fg.muted" mt={2} textAlign="left">
          This is an approximate preview. Send to Discord to see the actual representation.
        </Text>
      </PageAlertProvider>
    </Stack>
  );
};
