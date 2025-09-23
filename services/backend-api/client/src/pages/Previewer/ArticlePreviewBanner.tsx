import React, { useState } from "react";
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
import { RepeatIcon, WarningIcon } from "@chakra-ui/icons";
import { FaRss, FaDiscord } from "react-icons/fa";
import { usePreviewerContext } from "./PreviewerContext";
import { ArticleSelectionDialog } from "./ArticleSelectionDialog";

export const ArticlePreviewBanner: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get article state from context
  const { articles, currentArticleId, setCurrentArticleId, isLoading, error, fetchArticles } =
    usePreviewerContext();

  const currentArticle = articles.find((article) => article.id === currentArticleId) || null;

  const handleSendToDiscord = () => {
    // TODO: Implement send to Discord functionality
    console.log("Sending article to Discord:", currentArticle);
  };

  if (error) {
    return (
      <Box
        bg="gray.700"
        borderRadius="md"
        mb={4}
        overflow="hidden"
        borderTopWidth="4px"
        borderTopColor="red.400"
        aria-live="polite"
      >
        <VStack spacing={0} bg="red.800">
          <HStack justify="space-between" align="center" p={3} w="full" flexWrap="wrap" spacing={2}>
            <HStack spacing={2}>
              <Icon as={WarningIcon} color="white" />
              <Text fontWeight="sm">Failed to load preview articles.</Text>
            </HStack>
            <Button
              size="sm"
              variant="solid"
              // colorScheme="whiteAlpha"
              leftIcon={<RepeatIcon />}
              onClick={fetchArticles}
            >
              Retry fetching preview articles
            </Button>
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
                Fetching Articles...
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
          {currentArticle
            ? `Previewing article: ${currentArticle.title || "No title"}`
            : "No articles available for preview"}
        </Box>
        <VStack spacing={0}>
          <HStack justify="space-between" align="center" p={3} w="full" flexWrap="wrap" spacing={2}>
            <Stack>
              <HStack spacing={2}>
                <Icon as={FaRss} color="blue.400" />
                <Text fontSize="xs" color="gray.400" fontWeight="medium">
                  Previewing Article
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
                isDisabled={articles.length === 0}
                onClick={() => setIsDialogOpen(true)}
              >
                Change Article
              </Button>
              <Button
                size="sm"
                variant="solid"
                colorScheme="blue"
                leftIcon={<Icon as={FaDiscord} />}
                isDisabled={!currentArticle}
                onClick={handleSendToDiscord}
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
