import React from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  useColorModeValue,
  Avatar,
  Stack,
  Progress,
  Highlight,
  Divider,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { useFormContext } from "react-hook-form";
import { ArticlePreviewBanner } from "./ArticlePreviewBanner";
import DiscordView from "../../components/DiscordView";
import { useMessageBuilderContext } from "./MessageBuilderContext";
import MessageBuilderFormState from "./types/MessageBuilderFormState";
import { PageAlertContextOutlet, PageAlertProvider } from "../../contexts/PageAlertContext";
import { useCreateConnectionPreview } from "../../features/feedConnections/hooks";
import { FeedConnectionType, FeedDiscordChannelConnection } from "../../types";
import { DiscordApiComponent } from "../../types/discord/DiscordApiPayload";
import { useDebounce } from "../../hooks";
import { InlineErrorAlert } from "../../components";
import convertMessageBuilderStateToConnectionPreviewInput from "./utils/convertMessageBuilderStateToConnectionPreviewInput";
import { useUserFeedConnectionContext } from "../../contexts/UserFeedConnectionContext";
import { DiscordServerName, DiscordChannelName } from "../../features/discordServers";

// eslint-disable-next-line no-bitwise
const DISCORD_COMPONENTS_V2_FLAG = 1 << 15;

const DISCORD_V2_COMPONENT_TYPE = {
  ActionRow: 1,
  Button: 2,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  Separator: 14,
} as const;

interface DiscordMessagePreviewProps {
  maxHeight?: string | number;
}

export const DiscordMessagePreview: React.FC<DiscordMessagePreviewProps> = ({ maxHeight }) => {
  const {
    watch,
    formState: { isValid, isDirty },
  } = useFormContext<MessageBuilderFormState>();
  const messageComponent = watch("messageComponent");
  const bgColor = useColorModeValue("#36393f", "#36393f");
  const textColor = useColorModeValue("#dcddde", "#dcddde");
  const { currentArticle } = useMessageBuilderContext();
  const { connection, userFeed } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();

  const previewData = convertMessageBuilderStateToConnectionPreviewInput(
    userFeed,
    connection,
    messageComponent
  );

  const debouncedPreviewData = useDebounce(previewData, 500);

  const {
    data: connectionPreview,
    fetchStatus,
    error,
  } = useCreateConnectionPreview(FeedConnectionType.DiscordChannel, {
    enabled: !!currentArticle?.id && isValid,
    data: {
      connectionId: connection.id, // Mock connection ID for message builder
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

  const buttonColors: Record<string, { bg: string; color: string; border: string }> = {
    Primary: {
      bg: "#5865f2",
      color: "white",
      border: "hsl(0 calc(1*0%) 100%/0.0784313725490196)",
    },
    Secondary: {
      bg: "hsl(240 calc(1*4%) 60.784%/0.12156862745098039)",
      color: "hsl(240 calc(1*5.263%) 92.549%/1)",
      border:
        "color-mix(in oklab,hsl(240 calc(1*4%) 60.784%/0.0392156862745098) 100%,hsl(0 0% 0%/0.0392156862745098) 0%)",
    },
    Success: {
      bg: "#248046",
      color: "white",
      border: "hsl(0 calc(1*0%) 100%/0.0784313725490196)",
    },
    Danger: {
      bg: "#da373c",
      color: "white",
      border: "hsl(0 calc(1*0%) 100%/0.0784313725490196)",
    },
    Link: {
      bg: "hsl(240 calc(1*4%) 60.784%/0.12156862745098039)",
      color: "hsl(240 calc(1*5.263%) 92.549%/1)",
      border:
        "color-mix(in oklab,hsl(240 calc(1*4%) 60.784%/0.0392156862745098) 100%,hsl(0 0% 0%/0.0392156862745098) 0%)",
    },
  };

  const styleNumToName: Record<number, string> = {
    1: "Primary",
    2: "Secondary",
    3: "Success",
    4: "Danger",
    5: "Link",
  };

  const renderApiButton = (btn: DiscordApiComponent["accessory"], key: string): React.ReactNode => {
    if (!btn) return null;
    const styleName = styleNumToName[btn.style || 2] || "Secondary";
    const colors = buttonColors[styleName];
    const isLinkButton = styleName === "Link" && btn.url;

    return (
      <Button
        key={key}
        as={isLinkButton ? "a" : undefined}
        href={isLinkButton ? btn.url ?? undefined : undefined}
        target={isLinkButton ? "_blank" : undefined}
        rel={isLinkButton ? "noopener noreferrer" : undefined}
        size="sm"
        borderColor={colors.border}
        borderWidth="1px"
        bg={colors.bg}
        color={colors.color}
        isDisabled={btn.disabled}
        borderRadius="6px"
        fontWeight="medium"
        fontSize="14px"
        px={3}
        py={1.5}
        minH="32px"
        _hover={{ opacity: btn.disabled ? 0.6 : 0.9 }}
        _disabled={{ opacity: 0.6 }}
        _active={{ transform: "translateY(0px)" }}
        rightIcon={styleName === "Link" ? <ExternalLinkIcon boxSize={4} /> : undefined}
        textDecoration="none"
        _focus={{ textDecoration: "none" }}
      >
        {btn.label || "Button"}
      </Button>
    );
  };

  const renderApiComponent = (comp: DiscordApiComponent, index: number): React.ReactNode => {
    const { type } = comp;

    if (type === DISCORD_V2_COMPONENT_TYPE.Section) {
      return (
        <HStack spacing={2} align="flex-start" key={`section-${index}`}>
          <VStack align="stretch" spacing={1} flex={1}>
            {comp.components?.map((td, i) => (
              <Text key={td.content || `text-${index}-${i}`} fontSize="sm">
                {td.content || "[missing text]"}
              </Text>
            ))}
          </VStack>
          {comp.accessory && renderApiButton(comp.accessory, `acc-${index}`)}
        </HStack>
      );
    }

    if (type === DISCORD_V2_COMPONENT_TYPE.ActionRow) {
      return (
        <Box key={`actionrow-${index}`}>
          <HStack spacing={2}>
            {comp.components?.map((btn, i) => renderApiButton(btn, `btn-${index}-${i}`))}
          </HStack>
        </Box>
      );
    }

    if (type === DISCORD_V2_COMPONENT_TYPE.Separator) {
      const showDivider = comp.divider !== false;
      const spacing = comp.spacing === 2 ? 4 : 2;

      return (
        <Box key={`separator-${index}`} py={!showDivider ? `${spacing}px` : undefined}>
          {showDivider && <Divider borderColor="hsl(240 calc(1*4%) 60.784%/0.2)" />}
        </Box>
      );
    }

    return null;
  };

  // Handle error state
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

  const messages = connectionPreview?.result.messages || [];
  const firstMessage = messages[0];
  // eslint-disable-next-line no-bitwise
  const isV2Components = firstMessage && (firstMessage.flags ?? 0) & DISCORD_COMPONENTS_V2_FLAG;
  const v2Components = isV2Components ? firstMessage.components : null;
  // Filter messages for DiscordView (V1 only) - cast to expected type
  const legacyMessages = isV2Components
    ? []
    : (messages as Array<{
        content?: string | null;
        embeds?: Array<{
          title?: string;
          description?: string;
          url?: string;
          color?: number;
        }>;
        components?: Array<{
          type: number;
          components: Array<{
            type: number;
            style: number;
            label: string;
            url?: string;
          }>;
        }> | null;
      }>);

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
        {/* Server and Channel Info */}
        <HStack mb={2}>
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
        {/* Discord Message Preview */}
        <Box
          bg={bgColor}
          color={textColor}
          p={4}
          borderRadius="md"
          fontFamily="Whitney, 'Helvetica Neue', Helvetica, Arial, sans-serif"
          maxW="100%"
          maxH={maxHeight || { base: 300, lg: 450 }}
          h="100%"
          overflow="auto"
          position="relative"
        >
          {(isFetching || !currentArticle) && (
            <Progress
              position="absolute"
              top={0}
              left={0}
              right={0}
              size="sm"
              colorScheme="blue"
              isIndeterminate
              zIndex={2}
              aria-label="Updating message preview"
            />
          )}
          <HStack align="flex-start" spacing={3}>
            <Avatar
              size="sm"
              src="https://cdn.discordapp.com/avatars/302050872383242240/1fb101f4b0fe104b6b8c53ec5e3d5af6.png"
              name="MonitoRSS"
              borderRadius="50%"
              w={10}
              h={10}
            />
            <Stack spacing={1} flex={1} maxW="calc(100% - 40px - 0.75rem)">
              <HStack spacing={2} align="center">
                <Text fontSize="sm" fontWeight="semibold" color="white">
                  MonitoRSS
                </Text>
                <Box
                  fontSize="xs"
                  bg="#5865f2"
                  color="white"
                  px={1}
                  py={0.5}
                  borderRadius="sm"
                  fontWeight="bold"
                  lineHeight="1"
                >
                  ✓ APP
                </Box>
                <Text fontSize="xs" color="#a3a6aa" ml={1}>
                  Today at 12:04 PM
                </Text>
              </HStack>
              <Box>
                <VStack
                  align="stretch"
                  spacing={3}
                  maxW={legacyMessages.length > 0 ? undefined : "min(600px, 100%)"}
                  w="fit-content"
                >
                  {legacyMessages.length > 0 && (
                    <DiscordView
                      darkTheme
                      username="MonitoRSS"
                      avatar_url="https://cdn.discordapp.com/avatars/302050872383242240/1fb101f4b0fe104b6b8c53ec5e3d5af6.png"
                      messages={legacyMessages}
                      excludeHeader
                    />
                  )}
                  {isV2Components && v2Components && v2Components.length > 0 && (
                    <VStack align="stretch" spacing={2} maxWidth="min(600px, 100%)" w="fit-content">
                      {v2Components.map((comp, i) => renderApiComponent(comp, i))}
                    </VStack>
                  )}
                  {currentArticle &&
                    messages.length === 0 &&
                    !!messageComponent &&
                    messageComponent.children.length === 0 && (
                      <Text color="gray.400" fontSize="sm" fontStyle="italic">
                        No components added yet
                      </Text>
                    )}
                </VStack>
              </Box>
            </Stack>
          </HStack>
        </Box>
      </PageAlertProvider>
    </Stack>
  );
};
