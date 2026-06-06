import React, { useState, useContext } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Stack,
  Spinner,
  Skeleton,
} from "@chakra-ui/react";
import { FaRss, FaDiscord } from "react-icons/fa";
import { FaCircleInfo, FaArrowsRotate, FaTriangleExclamation } from "react-icons/fa6";
import { useMessageBuilderContext } from "./MessageBuilderContext";
import { ArticleSelectionDialog } from "./ArticleSelectionDialog";
import { SendTestArticleContext } from "./contexts/SendTestArticleContext";
import { Panel } from "@/components/Panel";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useUserFeedConnectionContext, useUserFeedContext } from "@/features/feed";
import { CreateDiscordChannelConnectionPreviewInput } from "../connection/api";
import { getConnectionWebhookChannelId } from "../connection/utils";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { FeedDiscordChannelConnection } from "@/types";
import convertMessageBuilderStateToConnectionPreviewInput from "./utils/convertMessageBuilderStateToConnectionPreviewInput";
import { useMessageBuilderStateContext } from "./state";

interface ArticlePreviewBannerProps {
  brandingDisplayName?: string;
  brandingAvatarUrl?: string;
}

export const ArticlePreviewBanner: React.FC<ArticlePreviewBannerProps> = ({
  brandingDisplayName,
  brandingAvatarUrl,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get article state from context
  const {
    currentArticleId,
    setCurrentArticleId,
    isLoading,
    error,
    errorDescription,
    currentArticle,
    hasNoArticles,
    isFetchingDifferentArticle,
  } = useMessageBuilderContext();

  const { userFeed } = useUserFeedContext();
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { isFetching: isSendingTestArticle, sendTestArticle } = useContext(SendTestArticleContext);
  const { createErrorAlert, createInfoAlert, createSuccessAlert } = usePageAlertContext();
  const { messageComponent } = useMessageBuilderStateContext();

  const handleSendToDiscord = async () => {
    if (isSendingTestArticle || !currentArticleId || !currentArticle) {
      return;
    }

    try {
      const messageComponentData = convertMessageBuilderStateToConnectionPreviewInput(
        userFeed,
        connection,
        messageComponent,
      );

      const previewInput: CreateDiscordChannelConnectionPreviewInput = {
        connectionId: connection.id,
        feedId: userFeed.id,
        data: {
          article: {
            id: currentArticleId,
          },
          ...messageComponentData,
          applicationWebhook:
            brandingDisplayName?.trim() || brandingAvatarUrl?.trim()
              ? {
                  channelId: getConnectionWebhookChannelId(connection) || "",
                  name: brandingDisplayName?.trim() || "",
                  iconUrl: brandingAvatarUrl?.trim() || undefined,
                }
              : undefined,
          sendAsBot:
            !brandingDisplayName?.trim() &&
            !brandingAvatarUrl?.trim() &&
            !!connection.details.webhook
              ? true
              : undefined,
        },
      };

      const resultInfo = await sendTestArticle(
        {
          connectionType: connection.key,
          previewInput,
        },
        {
          disableToast: true,
        },
      );

      if (resultInfo?.status === "info") {
        createInfoAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      } else if (resultInfo?.status === "success") {
        createSuccessAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      } else if (resultInfo?.status === "error") {
        createErrorAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      }
    } catch (err) {}
  };

  if (error) {
    return (
      <Panel
        surface="subtle"
        accent={!hasNoArticles ? "error" : "info"}
        mb={4}
        overflow="hidden"
        aria-live={hasNoArticles ? undefined : "polite"}
        data-tour-target="article-banner"
      >
        <VStack gap={0} bg={!hasNoArticles ? "red.subtle" : "blue.subtle"}>
          <HStack justify="space-between" align="center" p={3} w="full" flexWrap="wrap" gap={2}>
            <HStack gap={2}>
              {!hasNoArticles && (
                <>
                  <Icon as={FaTriangleExclamation} color="text.error" />
                  <Text fontWeight="sm">Failed to load preview articles.</Text>
                </>
              )}
              {hasNoArticles && (
                <>
                  <Icon as={FaCircleInfo} color="text.link" />
                  <Text fontWeight="sm">
                    This feed currently does not have any articles to preview.
                  </Text>
                </>
              )}
            </HStack>
          </HStack>
          <Box px={3} pb={3} w="full">
            <HStack>
              <Text fontSize="sm">{errorDescription || error}</Text>
            </HStack>
          </Box>
        </VStack>
      </Panel>
    );
  }

  if (isLoading) {
    return (
      <Panel surface="subtle" accent="brand" mb={4} overflow="hidden" aria-live="polite">
        <VStack gap={0}>
          <HStack justify="space-between" align="center" p={3} w="full" flexWrap="wrap" gap={2}>
            <HStack gap={2}>
              <Spinner size="sm" color="brand.solid" />
              <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                Fetching Article...
              </Text>
            </HStack>
          </HStack>
          <Box px={3} pb={3} w="full">
            <Skeleton height="40px" borderRadius="l3" />
          </Box>
        </VStack>
      </Panel>
    );
  }

  return (
    <>
      <Panel
        surface="subtle"
        accent="brand"
        mb={4}
        overflow="hidden"
        data-tour-target="article-banner"
      >
        <Box aria-live="polite" srOnly>
          <span>
            {isFetchingDifferentArticle && "Loading different article..."}
            {!isFetchingDifferentArticle && !currentArticle && "No articles available for preview"}
            {!isFetchingDifferentArticle &&
              !!currentArticle &&
              `Previewing article: ${currentArticle.title || "No title"}`}
          </span>
        </Box>
        <VStack gap={0}>
          <HStack justify="space-between" align="center" p={3} w="full" flexWrap="wrap" gap={2}>
            <Stack>
              <HStack gap={2}>
                {isFetchingDifferentArticle ? (
                  <Spinner size="sm" color="brand.solid" />
                ) : (
                  <Icon as={FaRss} color="brand.solid" />
                )}
                <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                  {isFetchingDifferentArticle ? "Loading Article..." : "Previewing Article"}
                </Text>
              </HStack>
              <Text
                fontSize="sm"
                color="fg"
                fontWeight="medium"
                lineClamp={2}
                fontStyle={!currentArticle?.title ? "italic" : "normal"}
              >
                {currentArticle?.title || "[No title]"}
              </Text>
            </Stack>
            <HStack gap={2}>
              <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(true)}>
                <FaArrowsRotate />
                Change Article
              </Button>
              <PrimaryActionButton
                size="sm"
                variant="solid"
                aria-disabled={!currentArticle || isSendingTestArticle}
                onClick={() => {
                  if (!currentArticle || isSendingTestArticle) {
                    return;
                  }

                  handleSendToDiscord();
                }}
              >
                <Icon as={FaDiscord} />
                <span>{isSendingTestArticle ? "Sending to Discord..." : "Send to Discord"}</span>
              </PrimaryActionButton>
            </HStack>
          </HStack>
        </VStack>
      </Panel>
      <ArticleSelectionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelectArticle={setCurrentArticleId}
        currentArticleId={currentArticleId}
        error={error || undefined}
      />
    </>
  );
};
