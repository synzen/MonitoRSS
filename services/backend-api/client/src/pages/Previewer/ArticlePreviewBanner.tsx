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
import { InfoIcon, RepeatIcon, WarningIcon } from "@chakra-ui/icons";
import { FaRss, FaDiscord } from "react-icons/fa";
import { useFormContext } from "react-hook-form";
import { usePreviewerContext } from "./PreviewerContext";
import { ArticleSelectionDialog } from "./ArticleSelectionDialog";
import { SendTestArticleContext } from "../../contexts";
import { useUserFeedConnectionContext } from "../../contexts/UserFeedConnectionContext";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import { CreateDiscordChannelConnectionPreviewInput } from "../../features/feedConnections/api";
import { usePageAlertContext } from "../../contexts/PageAlertContext";
import PreviewerFormState from "./types/PreviewerFormState";
import { FeedDiscordChannelConnection } from "../../types";
import convertPreviewerStateToConnectionPreviewInput from "./utils/convertPreviewerStateToConnectionPreviewInput";

export const ArticlePreviewBanner: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get article state from context
  const {
    currentArticleId,
    setCurrentArticleId,
    isLoading,
    error,
    currentArticle,
    hasNoArticles,
    isFetchingDifferentArticle,
  } = usePreviewerContext();

  const { userFeed } = useUserFeedContext();
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { isFetching: isSendingTestArticle, sendTestArticle } = useContext(SendTestArticleContext);
  const { createErrorAlert, createInfoAlert, createSuccessAlert } = usePageAlertContext();
  const { getValues } = useFormContext<PreviewerFormState>();

  const handleSendToDiscord = async () => {
    if (isSendingTestArticle || !currentArticleId || !currentArticle) {
      return;
    }

    try {
      const formState = getValues();
      const messageComponentData = convertPreviewerStateToConnectionPreviewInput(
        userFeed,
        connection,
        formState.messageComponent,
        currentArticle
      );

      const previewInput: CreateDiscordChannelConnectionPreviewInput = {
        connectionId: connection.id,
        feedId: userFeed.id,
        data: {
          article: {
            id: currentArticleId,
          },
          ...messageComponentData,
        },
      };

      const resultInfo = await sendTestArticle(
        {
          connectionType: connection.key,
          previewInput,
        },
        {
          disableToast: true,
        }
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
      <Box
        bg="gray.700"
        borderRadius="md"
        mb={4}
        overflow="hidden"
        borderTopWidth="4px"
        borderTopColor={!hasNoArticles ? "red.400" : "blue.400"}
        aria-live={hasNoArticles ? undefined : "polite"}
      >
        <VStack spacing={0} bg={!hasNoArticles ? "red.800" : "blue.800"}>
          <HStack justify="space-between" align="center" p={3} w="full" flexWrap="wrap" spacing={2}>
            <HStack spacing={2}>
              {!hasNoArticles && (
                <>
                  <Icon as={WarningIcon} color="white" />
                  <Text fontWeight="sm">Failed to load preview articles.</Text>
                </>
              )}
              {hasNoArticles && (
                <>
                  <Icon as={InfoIcon} color="white" />
                  <Text fontWeight="sm">
                    This feed currently does not have any articles to preview.
                  </Text>
                </>
              )}
            </HStack>
          </HStack>
          <Box px={3} pb={3} w="full">
            <HStack>
              <Text fontSize="sm">{error}</Text>
            </HStack>
          </Box>
        </VStack>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        bg="gray.700"
        borderRadius="md"
        mb={4}
        overflow="hidden"
        borderTopWidth="4px"
        borderTopColor="blue.400"
        aria-live="polite"
      >
        <VStack spacing={0}>
          <HStack justify="space-between" align="center" p={3} w="full" flexWrap="wrap" spacing={2}>
            <HStack spacing={2}>
              <Spinner size="sm" color="blue.400" />
              <Text fontSize="xs" color="gray.400" fontWeight="medium">
                Fetching Article...
              </Text>
            </HStack>
          </HStack>
          <Box px={3} pb={3} w="full">
            <Skeleton height="40px" borderRadius="md" />
          </Box>
        </VStack>
      </Box>
    );
  }

  return (
    <>
      <Box
        bg="gray.700"
        borderRadius="md"
        mb={4}
        overflow="hidden"
        borderTopWidth="4px"
        borderTopColor="blue.400"
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
        <VStack spacing={0}>
          <HStack justify="space-between" align="center" p={3} w="full" flexWrap="wrap" spacing={2}>
            <Stack>
              <HStack spacing={2}>
                {isFetchingDifferentArticle ? (
                  <Spinner size="sm" color="blue.400" />
                ) : (
                  <Icon as={FaRss} color="blue.400" />
                )}
                <Text fontSize="xs" color="gray.400" fontWeight="medium">
                  {isFetchingDifferentArticle ? "Loading Article..." : "Previewing Article"}
                </Text>
              </HStack>
              <Text
                fontSize="sm"
                color="white"
                fontWeight="medium"
                noOfLines={2}
                fontStyle={!currentArticle?.title ? "italic" : "normal"}
              >
                {currentArticle?.title || "[No title]"}
              </Text>
            </Stack>
            <HStack spacing={2}>
              <Button
                size="sm"
                variant="outline"
                color="gray.200"
                leftIcon={<RepeatIcon />}
                onClick={() => setIsDialogOpen(true)}
              >
                Change Article
              </Button>
              <Button
                size="sm"
                variant="solid"
                colorScheme="blue"
                leftIcon={<Icon as={FaDiscord} />}
                isLoading={isSendingTestArticle}
                aria-disabled={!currentArticle}
                onClick={() => {
                  if (!currentArticle) {
                    return;
                  }

                  handleSendToDiscord();
                }}
              >
                Send to Discord
              </Button>
            </HStack>
          </HStack>
        </VStack>
      </Box>
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
