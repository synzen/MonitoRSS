import React from "react";
import { FaDiscord } from "react-icons/fa";
import { InfoIcon, LockIcon } from "@chakra-ui/icons";
import {
  VStack,
  Box,
  Button,
  Skeleton,
  Text,
  Select,
  Alert,
  AlertIcon,
  AlertDescription,
  FormControl,
  FormLabel,
  HStack,
  Input,
} from "@chakra-ui/react";
import { DiscordMessageDisplay } from "../../../../components/DiscordMessageDisplay";
import { TestSendFeedback } from "../../types";
import { Article, Branding } from "./types";
import { useBrandingContext } from "./BrandingContext";

export interface PreviewColumnProps {
  articles: Article[];
  selectedArticleId?: string;
  onArticleChange: (articleId: string) => void;
  selectedTemplateId?: string;
  previewMessages: Array<Record<string, unknown>>;
  isActuallyLoading: boolean;
  isPreviewError: boolean;
  showComparisonPreview?: boolean;
  currentFormatMessages: Array<Record<string, unknown>>;
  isCurrentFormatLoading: boolean;
  isCurrentFormatError: boolean;
  onTestSend?: (branding?: Branding) => void;
  isTestSendLoading?: boolean;
  canTestSend: boolean;
  hasArticles: boolean;
  testSendFeedback?: TestSendFeedback | null;
}

export const PreviewColumn = ({
  articles,
  selectedArticleId,
  onArticleChange,
  selectedTemplateId,
  previewMessages,
  isActuallyLoading,
  isPreviewError,
  showComparisonPreview,
  currentFormatMessages,
  isCurrentFormatLoading,
  isCurrentFormatError,
  onTestSend,
  isTestSendLoading,
  canTestSend,
  hasArticles,
  testSendFeedback,
}: PreviewColumnProps) => {
  const {
    displayName: brandingDisplayName,
    setDisplayName: onBrandingDisplayNameChange,
    avatarUrl: brandingAvatarUrl,
    setAvatarUrl: onBrandingAvatarUrlChange,
    isDisabled: isBrandingDisabled,
    disabledReason: brandingDisabledReason,
    webhooksAllowed,
    hasBrandingValues,
  } = useBrandingContext();

  return (
    <Box
      bg="gray.900"
      borderRadius="md"
      p={4}
      minH={{ base: "200px", lg: "400px" }}
      role="region"
      aria-label="Template preview"
      aria-busy={isActuallyLoading || isCurrentFormatLoading}
    >
      {articles.length > 0 && (
        <FormControl mb={4}>
          <FormLabel htmlFor="article-selector" fontSize="xs" color="gray.400" mb={1}>
            Preview article
          </FormLabel>
          <Select
            id="article-selector"
            value={selectedArticleId || ""}
            onChange={(e) => onArticleChange(e.target.value)}
            bg="gray.700"
            borderColor="gray.600"
            size="sm"
            color="white"
            _hover={{ borderColor: "gray.500" }}
          >
            {articles.map((article) => (
              <option key={article.id} value={article.id} style={{ backgroundColor: "#2D3748" }}>
                {article.title || article.id}
              </option>
            ))}
          </Select>
        </FormControl>
      )}
      {previewMessages.length > 0 && (
        <Box
          mb={4}
          p={3}
          borderRadius="md"
          border="1px solid"
          borderColor="whiteAlpha.200"
          bg="gray.800"
        >
          {isBrandingDisabled && (
            <HStack spacing={2} mb={2} id="branding-disabled-reason">
              <InfoIcon boxSize={3} color="whiteAlpha.700" aria-hidden="true" />
              <Text fontSize="sm" color="whiteAlpha.700">
                {brandingDisabledReason}
              </Text>
            </HStack>
          )}
          {!isBrandingDisabled && !webhooksAllowed && (
            <HStack spacing={2} mb={2}>
              <LockIcon boxSize={3} color="whiteAlpha.700" />
              <Text fontSize="xs" color="whiteAlpha.700">
                Free plan — preview how your branding looks, then upgrade to save it.
              </Text>
            </HStack>
          )}
          <HStack spacing={3} flexWrap="wrap">
            <FormControl flex={1} minW="150px" isDisabled={isBrandingDisabled}>
              <FormLabel fontSize="xs" color="gray.400" mb={1}>
                Display Name
              </FormLabel>
              <Input
                size="sm"
                bg="gray.700"
                borderColor="gray.600"
                placeholder="e.g. Gaming News"
                value={brandingDisplayName}
                onChange={(e) => onBrandingDisplayNameChange(e.target.value)}
                opacity={isBrandingDisabled ? 0.6 : undefined}
                aria-describedby={isBrandingDisabled ? "branding-disabled-reason" : undefined}
              />
            </FormControl>
            <FormControl flex={1} minW="150px" isDisabled={isBrandingDisabled}>
              <FormLabel fontSize="xs" color="gray.400" mb={1}>
                Avatar URL
              </FormLabel>
              <Input
                size="sm"
                bg="gray.700"
                borderColor="gray.600"
                placeholder="https://example.com/avatar.png"
                value={brandingAvatarUrl}
                onChange={(e) => onBrandingAvatarUrlChange(e.target.value)}
                opacity={isBrandingDisabled ? 0.6 : undefined}
                aria-describedby={isBrandingDisabled ? "branding-disabled-reason" : undefined}
              />
            </FormControl>
          </HStack>
        </Box>
      )}
      {showComparisonPreview && (
        <VStack spacing={4} align="stretch">
          <Box>
            <Text fontSize="sm" fontWeight="semibold" color="gray.400" mb={2}>
              Current Format
            </Text>
            {isCurrentFormatLoading && <Skeleton height="200px" borderRadius="md" />}
            {!isCurrentFormatLoading && isCurrentFormatError && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                Failed to load current format preview.
              </Alert>
            )}
            {!isCurrentFormatLoading &&
              !isCurrentFormatError &&
              currentFormatMessages.length > 0 && (
                <DiscordMessageDisplay
                  messages={currentFormatMessages}
                  maxHeight={200}
                  username={brandingDisplayName || undefined}
                  avatarUrl={brandingAvatarUrl || undefined}
                  showVerifiedInAppBadge={!hasBrandingValues}
                />
              )}
            {!isCurrentFormatLoading &&
              !isCurrentFormatError &&
              currentFormatMessages.length === 0 && (
                <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
                  No current format to display
                </Box>
              )}
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="semibold" color="gray.400" mb={2}>
              Template Preview
            </Text>
            {!selectedTemplateId && (
              <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
                Select a template to compare
              </Box>
            )}
            {selectedTemplateId && isActuallyLoading && (
              <Skeleton height="200px" borderRadius="md" />
            )}
            {selectedTemplateId && !isActuallyLoading && isPreviewError && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                Failed to load template preview.
              </Alert>
            )}
            {selectedTemplateId &&
              !isActuallyLoading &&
              !isPreviewError &&
              previewMessages.length > 0 && (
                <DiscordMessageDisplay
                  messages={previewMessages}
                  maxHeight={200}
                  username={brandingDisplayName || undefined}
                  avatarUrl={brandingAvatarUrl || undefined}
                  showVerifiedInAppBadge={!hasBrandingValues}
                />
              )}
            {selectedTemplateId &&
              !isActuallyLoading &&
              !isPreviewError &&
              previewMessages.length === 0 && (
                <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
                  There are currently no articles in the feed to preview. You can save now -
                  previews will be available once articles arrive.
                </Box>
              )}
          </Box>
          <Text fontSize="sm" color="gray.400" mt={2}>
            These are approximate previews. Send to Discord to see the actual representation.
          </Text>
        </VStack>
      )}
      {!showComparisonPreview && (
        <Box>
          <Text fontSize="sm" color="gray.400" mb={3}>
            Preview
          </Text>
          {!selectedTemplateId && (
            <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
              Select a template to preview
            </Box>
          )}
          {selectedTemplateId && isActuallyLoading && (
            <Skeleton height="300px" borderRadius="md" aria-label="Loading preview" />
          )}
          {selectedTemplateId && !isActuallyLoading && isPreviewError && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              Failed to load preview. Please try again.
            </Alert>
          )}
          {selectedTemplateId &&
            !isActuallyLoading &&
            !isPreviewError &&
            previewMessages.length > 0 && (
              <DiscordMessageDisplay
                messages={previewMessages}
                maxHeight={{ base: 200, lg: 350 }}
                username={brandingDisplayName || undefined}
                avatarUrl={brandingAvatarUrl || undefined}
                showVerifiedInAppBadge={!hasBrandingValues}
              />
            )}
          {selectedTemplateId &&
            !isActuallyLoading &&
            !isPreviewError &&
            previewMessages.length === 0 &&
            articles.length === 0 && (
              <Text color="gray.500" textAlign="center" py={8}>
                There are currently no articles in the feed to preview. You can save now - previews
                will be available once articles arrive.
              </Text>
            )}
          {!!articles.length && (
            <Text fontSize="sm" color="gray.400" mt={2}>
              This is an approximate preview. Send to Discord to see the actual representation.
            </Text>
          )}
        </Box>
      )}
      {onTestSend && hasArticles && (
        <Box mt={4}>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onTestSend?.({
                name: brandingDisplayName,
                iconUrl: brandingAvatarUrl || undefined,
              })
            }
            isLoading={isTestSendLoading}
            isDisabled={!canTestSend}
            aria-busy={isTestSendLoading}
            leftIcon={<FaDiscord />}
          >
            {isTestSendLoading ? "Sending..." : "Send to Discord"}
          </Button>
        </Box>
      )}
      {testSendFeedback && !testSendFeedback.deliveryStatus && (
        <Box mt={3}>
          {testSendFeedback.status === "success" && (
            <Alert status="success" borderRadius="md" size="sm">
              <AlertIcon />
              <AlertDescription>{testSendFeedback.message}</AlertDescription>
            </Alert>
          )}
          {testSendFeedback.status === "error" && (
            <Alert status="error" borderRadius="md" size="sm">
              <AlertIcon />
              <AlertDescription>{testSendFeedback.message}</AlertDescription>
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};
