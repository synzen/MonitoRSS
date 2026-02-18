import { useState } from "react";
import { Box, HStack, Text, Badge, Button, Spinner, Link } from "@chakra-ui/react";
import { CheckIcon, WarningIcon } from "@chakra-ui/icons";
import { Link as RouterLink } from "react-router-dom";
import { getAvatarColor } from "@/utils/getAvatarColor";
import { getCuratedFeedErrorMessage } from "./getCuratedFeedErrorMessage";

interface FeedCardProps {
  feed: {
    title: string;
    domain: string;
    description: string;
    popular?: boolean;
    url: string;
  };
  state: "default" | "adding" | "added" | "error" | "limit-reached";
  onAdd: () => void;
  errorMessage?: string;
  errorCode?: string;
  isCurated?: boolean;
  showPopularBadge?: boolean;
  showDomain?: boolean;
  showCategoryTag?: string;
  feedSettingsUrl?: string;
}

export const FeedCard = ({
  feed,
  state,
  onAdd,
  errorMessage,
  errorCode,
  isCurated,
  showPopularBadge = true,
  showDomain = true,
  showCategoryTag,
  feedSettingsUrl,
}: FeedCardProps) => {
  const [imgError, setImgError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const errorId = `feed-error-${feed.url.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const errorDetailsId = `feed-error-details-${feed.url.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const displayErrorMessage =
    state === "error" && isCurated
      ? getCuratedFeedErrorMessage(errorCode)
      : errorMessage || "Failed to add feed";

  return (
    <Box
      bg="gray.800"
      borderWidth="1px"
      borderColor={state === "error" ? "red.400" : "gray.600"}
      borderRadius="md"
      p={3}
      opacity={state === "added" ? 0.7 : 1}
    >
      <HStack spacing={3} align="start">
        <Box flexShrink={0}>
          {imgError ? (
            <Box
              w="32px"
              h="32px"
              borderRadius="full"
              bg={getAvatarColor(feed.title)}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="white" fontSize="sm" fontWeight="bold" lineHeight="1">
                {feed.title.charAt(0).toUpperCase()}
              </Text>
            </Box>
          ) : (
            <Box
              w="32px"
              h="32px"
              borderRadius="md"
              bg="white"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <img
                src={`https://www.google.com/s2/favicons?sz=32&domain=${feed.domain}`}
                alt=""
                width={28}
                height={28}
                onError={() => setImgError(true)}
              />
            </Box>
          )}
        </Box>

        <Box flex={1} minW={0}>
          <HStack spacing={2} flexWrap="wrap">
            <Text fontWeight="bold" noOfLines={1}>
              {feed.title}
            </Text>
            {feed.popular && showPopularBadge && (
              <Badge
                colorScheme="purple"
                variant="subtle"
                borderRadius="full"
                fontSize="xs"
                textTransform="none"
                flexShrink={0}
                aria-label="Most added in this category"
                px={2}
              >
                Most added
              </Badge>
            )}
            {showCategoryTag && (
              <Badge
                colorScheme="gray"
                variant="subtle"
                borderRadius="full"
                fontSize="x-small"
                textTransform="none"
                flexShrink={0}
              >
                {showCategoryTag}
              </Badge>
            )}
          </HStack>
          {showDomain && (
            <Text color="gray.400" fontSize="xs" noOfLines={1}>
              {feed.domain}
            </Text>
          )}
          <Text color="gray.400" noOfLines={1} fontSize="sm">
            {feed.description}
          </Text>
        </Box>

        <Box flexShrink={0}>
          {state === "default" && (
            <Button size="sm" onClick={onAdd} aria-label={`Add ${feed.title} feed`}>
              + Add
            </Button>
          )}
          {state === "adding" && (
            <Button
              size="sm"
              aria-label={`Adding ${feed.title} feed...`}
              aria-disabled="true"
              onClick={(e) => e.preventDefault()}
            >
              <Spinner size="xs" />
            </Button>
          )}
          {state === "added" && (
            <Button
              size="sm"
              aria-label={`${feed.title} feed added`}
              aria-disabled="true"
              onClick={(e) => e.preventDefault()}
            >
              Added <CheckIcon ml={1} aria-hidden="true" />
            </Button>
          )}
          {state === "error" && (
            <Button size="sm" onClick={onAdd} aria-describedby={errorId}>
              Retry
            </Button>
          )}
          {state === "limit-reached" && (
            <Button size="sm" aria-disabled="true" onClick={(e) => e.preventDefault()}>
              Limit reached
            </Button>
          )}
        </Box>
      </HStack>

      {state === "error" && (
        <Box mt={2}>
          <HStack spacing={2} align="start">
            <WarningIcon color="red.300" mt="2px" aria-hidden="true" />
            <Box>
              <Text color="red.300" fontSize="sm" role="alert" id={errorId} display="inline">
                {displayErrorMessage}
              </Text>
              {isCurated && (
                <Button
                  variant="link"
                  fontSize="xs"
                  color="gray.400"
                  ml={2}
                  display="inline-flex"
                  verticalAlign="baseline"
                  onClick={() => setShowDetails((prev) => !prev)}
                  aria-expanded={showDetails}
                  aria-controls={errorDetailsId}
                >
                  {showDetails ? "Hide details" : "Show details"}
                </Button>
              )}
            </Box>
          </HStack>
          {isCurated && (
            <Box
              id={errorDetailsId}
              mt={2}
              pl={6}
              fontSize="xs"
              color="gray.400"
              hidden={!showDetails}
              as="dl"
            >
              <HStack spacing={1} align="baseline">
                <Text as="dt" fontWeight="semibold" color="gray.300" flexShrink={0}>
                  URL
                </Text>
                <Text as="dd" wordBreak="break-all">
                  {feed.url}
                </Text>
              </HStack>
              {errorMessage && (
                <HStack spacing={1} align="baseline" mt={1}>
                  <Text as="dt" fontWeight="semibold" color="gray.300" flexShrink={0}>
                    Error
                  </Text>
                  <Text as="dd">{errorMessage}</Text>
                </HStack>
              )}
            </Box>
          )}
        </Box>
      )}

      {state === "added" && feedSettingsUrl && (
        <Box mt={2}>
          <Link
            as={RouterLink}
            to={feedSettingsUrl}
            color="blue.300"
            fontSize="sm"
            aria-label={`Go to feed settings for ${feed.title}`}
          >
            Go to feed settings
          </Link>
        </Box>
      )}
    </Box>
  );
};
