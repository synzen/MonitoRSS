import { useState } from "react";
import { Box, Text, Button, Spinner, Link, HStack } from "@chakra-ui/react";
import { CheckIcon, WarningIcon } from "@chakra-ui/icons";
import { Link as RouterLink } from "react-router-dom";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getAvatarColor } from "@/utils/getAvatarColor";
import { CreateUserFeedUrlValidationOutput } from "../../api/createUserFeedUrlValidation";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { FixFeedRequestsCTA } from "../FixFeedRequestsCTA";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage copy";
import { pages } from "@/constants";
import { useCreateUserFeed } from "../../hooks";
import { FeedCard } from "../FeedCard";

const NO_FEED_FOUND_CODES: string[] = [
  ApiErrorCode.FEED_INVALID,
  ApiErrorCode.FEED_PARSE_FAILED,
  ApiErrorCode.ADD_FEED_PARSE_FAILED,
  ApiErrorCode.NO_FEED_IN_HTML_PAGE,
];

interface UrlValidationResultProps {
  url: string;
  validationStatus: "idle" | "loading" | "success" | "error";
  validationData: CreateUserFeedUrlValidationOutput | undefined;
  validationError: ApiAdapterError | null;
  isAtLimit: boolean;
  onTrySearchByName: () => void;
  onRetryValidation: () => void;
  onFeedAdded?: (feedId: string, feedUrl: string) => void;
}

export const UrlValidationResult = ({
  url,
  validationStatus,
  validationData,
  validationError,
  isAtLimit,
  onTrySearchByName,
  onRetryValidation,
  onFeedAdded,
}: UrlValidationResultProps) => {
  const { mutateAsync: createFeed } = useCreateUserFeed();
  const [addedFeedId, setAddedFeedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<ApiAdapterError | null>(null);
  const [resolvedIconError, setResolvedIconError] = useState(false);

  const feedUrl = validationData?.result.resolvedToUrl || url;

  const handleAdd = async () => {
    if (isAdding || addedFeedId) return;

    setAddError(null);
    setIsAdding(true);

    try {
      const { result } = await createFeed({
        details: { url: feedUrl },
      });
      setAddedFeedId(result.id);
      onFeedAdded?.(result.id, feedUrl);
    } catch (err) {
      setAddError(err as ApiAdapterError);
    } finally {
      setIsAdding(false);
    }
  };

  const isLimitReachedError = addError?.errorCode === ApiErrorCode.FEED_LIMIT_REACHED;

  const getButtonState = (): "default" | "limit" | "adding" | "added" | "limit-error" => {
    if (addedFeedId) return "added";
    if (isAdding) return "adding";
    if (isLimitReachedError) return "limit-error";
    if (isAtLimit) return "limit";
    return "default";
  };

  const buttonState = getButtonState();

  if (validationStatus === "loading") {
    return (
      <Box aria-live="polite" mt={3}>
        <HStack spacing={2}>
          <Spinner size="sm" />
          <Text>Checking URL...</Text>
        </HStack>
        <Text fontSize="sm" color="gray.400">
          Verifying the feed at this address
        </Text>
      </Box>
    );
  }

  if (validationStatus === "success" && validationData) {
    const hasResolvedUrl = !!validationData.result.resolvedToUrl;

    if (hasResolvedUrl) {
      let resolvedHostname: string;

      try {
        resolvedHostname = new URL(validationData.result.resolvedToUrl!).hostname;
      } catch {
        resolvedHostname = validationData.result.resolvedToUrl!;
      }

      let originalHostname: string;

      try {
        originalHostname = new URL(url).hostname;
      } catch {
        originalHostname = url;
      }

      const feedTitle = validationData.result.feedTitle || resolvedHostname;

      return (
        <Box mt={3}>
          <Box borderLeftWidth="4px" borderLeftColor="yellow.400" pl={3} py={2}>
            <HStack spacing={2} mb={2}>
              <WarningIcon color="yellow.400" aria-hidden="true" />
              <Text fontWeight="bold">We found a feed at a different URL</Text>
            </HStack>
            <HStack spacing={3} align="center" mb={2}>
              <Box flexShrink={0}>
                {resolvedIconError ? (
                  <Box
                    w="32px"
                    h="32px"
                    borderRadius="full"
                    bg={getAvatarColor(feedTitle)}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text color="white" fontSize="sm" fontWeight="bold" lineHeight="1">
                      {feedTitle.charAt(0).toUpperCase()}
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
                  >
                    <img
                      src={`https://www.google.com/s2/favicons?sz=32&domain=${originalHostname}`}
                      alt=""
                      width={28}
                      height={28}
                      onError={() => setResolvedIconError(true)}
                    />
                  </Box>
                )}
              </Box>
              <Text fontWeight="bold" color="white">
                {feedTitle}
              </Text>
            </HStack>
            <Box as="dl" fontSize="sm" mb={2}>
              <HStack spacing={1} align="baseline" mb={1}>
                <Text as="dt" fontWeight="semibold" color="gray.300" flexShrink={0}>
                  Your URL:
                </Text>
                <Text as="dd" color="gray.100" wordBreak="break-all">
                  {url}
                </Text>
              </HStack>
              <HStack spacing={1} align="baseline">
                <Text as="dt" fontWeight="semibold" color="gray.300" flexShrink={0}>
                  Feed found:
                </Text>
                <Text as="dd" color="gray.100" wordBreak="break-all">
                  {validationData.result.resolvedToUrl}
                </Text>
              </HStack>
            </Box>
            <HStack spacing={2}>
              {buttonState === "default" && (
                <Button size="sm" onClick={handleAdd}>
                  + Add this feed
                </Button>
              )}
              {buttonState === "limit" && (
                <Button size="sm" aria-disabled="true" onClick={(e) => e.preventDefault()}>
                  Limit reached
                </Button>
              )}
              {buttonState === "adding" && (
                <Button size="sm" aria-disabled="true" onClick={(e) => e.preventDefault()}>
                  <Spinner size="xs" />
                </Button>
              )}
              {buttonState === "added" && (
                <HStack spacing={2}>
                  <Button size="sm" aria-disabled="true" onClick={(e) => e.preventDefault()}>
                    Added <CheckIcon ml={1} aria-hidden="true" />
                  </Button>
                  <Link
                    as={RouterLink}
                    to={pages.userFeed(addedFeedId!)}
                    color="blue.300"
                    fontSize="sm"
                  >
                    Go to feed settings
                  </Link>
                </HStack>
              )}
              {buttonState === "limit-error" && (
                <Button size="sm" aria-disabled="true" onClick={(e) => e.preventDefault()}>
                  Limit reached
                </Button>
              )}
            </HStack>
          </Box>
          {addError && !isLimitReachedError && (
            <Box mt={2}>
              <InlineErrorAlert title="Failed to add feed" description={addError.message} />
            </Box>
          )}
        </Box>
      );
    }

    let hostname: string;

    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }

    const feedTitle = validationData.result.feedTitle || hostname;

    return (
      <Box mt={3}>
        <FeedCard
          feed={{
            title: feedTitle,
            domain: hostname,
            description: url,
            url,
          }}
          state={
            buttonState === "default"
              ? "default"
              : buttonState === "adding"
                ? "adding"
                : buttonState === "added"
                  ? "added"
                  : "limit-reached"
          }
          onAdd={handleAdd}
          errorMessage={addError && !isLimitReachedError ? "Failed to add feed" : undefined}
          feedSettingsUrl={addedFeedId ? pages.userFeed(addedFeedId) : undefined}
        />
        {addError && !isLimitReachedError && (
          <Box mt={2}>
            <InlineErrorAlert title="Failed to add feed" description={addError.message} />
          </Box>
        )}
      </Box>
    );
  }

  if (validationStatus === "error" && validationError) {
    const isNoFeedFound =
      validationError.errorCode && NO_FEED_FOUND_CODES.includes(validationError.errorCode);

    if (isNoFeedFound) {
      return (
        <Box mt={3}>
          <Box borderLeftWidth="4px" borderLeftColor="red.400" pl={3} py={2}>
            <Text fontWeight="bold" mb={1}>
              Couldn&apos;t find a feed
            </Text>
            <Text fontSize="sm" color="gray.400" mb={2}>
              {validationError.message}
            </Text>
            <Button size="sm" variant="outline" onClick={onTrySearchByName}>
              Try searching by name instead
            </Button>
          </Box>
        </Box>
      );
    }

    return (
      <Box mt={3}>
        <InlineErrorAlert title="Failed to validate feed" description={validationError.message} />
        <FixFeedRequestsCTA url={url} onCorrected={onRetryValidation} />
      </Box>
    );
  }

  return null;
};
