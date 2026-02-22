import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Text,
  Button,
  Spinner,
  HStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  VisuallyHidden,
} from "@chakra-ui/react";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { CreateUserFeedUrlValidationOutput } from "../../api/createUserFeedUrlValidation";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { FixFeedRequestsCTA } from "../FixFeedRequestsCTA";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage copy";
import { pages } from "@/constants";
import { useCreateUserFeed } from "../../hooks";
import { useDeleteUserFeed } from "../../hooks/useDeleteUserFeed";
import { FeedCard } from "../FeedCard";
import { isExpectedResolutionUrl } from "./PlatformHint";

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
  onFeedRemoved?: (feedUrl: string) => void;
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
  onFeedRemoved,
}: UrlValidationResultProps) => {
  const { mutateAsync: createFeed } = useCreateUserFeed();
  const { mutateAsync: deleteFeed } = useDeleteUserFeed();
  const [addedFeedId, setAddedFeedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [addError, setAddError] = useState<ApiAdapterError | null>(null);
  const feedUrl = validationData?.result.resolvedToUrl || url;

  useEffect(() => {
    setAddedFeedId(null);
    setIsAdding(false);
    setIsRemoving(false);
    setAddError(null);
  }, [url]);

  const handleAdd = async (title?: string) => {
    if (isAdding || addedFeedId) return;

    setAddError(null);
    setIsAdding(true);

    try {
      const { result } = await createFeed({
        details: { url: feedUrl, title },
      });
      setAddedFeedId(result.id);
      onFeedAdded?.(result.id, feedUrl);
    } catch (err) {
      setAddError(err as ApiAdapterError);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = useCallback(async () => {
    if (!addedFeedId || isRemoving) return;

    setIsRemoving(true);

    try {
      await deleteFeed({ feedId: addedFeedId });
      setAddedFeedId(null);
      setIsRemoving(false);
      onFeedRemoved?.(feedUrl);
    } catch {
      setIsRemoving(false);
    }
  }, [addedFeedId, isRemoving, deleteFeed, onFeedRemoved, feedUrl]);

  const isLimitReachedError = addError?.errorCode === ApiErrorCode.FEED_LIMIT_REACHED;

  const getButtonState = ():
    | "default"
    | "limit"
    | "adding"
    | "added"
    | "limit-error"
    | "removing" => {
    if (isRemoving) return "removing";
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

    let hostname: string;

    try {
      hostname = new URL(feedUrl).hostname;
    } catch {
      hostname = feedUrl;
    }

    const displayTitle = validationData.result.feedTitle || hostname;

    const showRedirectNote = hasResolvedUrl && !isExpectedResolutionUrl(url);
    const redirectedFrom = showRedirectNote ? url : undefined;

    const feedCardState =
      buttonState === "limit" || buttonState === "limit-error"
        ? "limit-reached"
        : (buttonState as "default" | "adding" | "added" | "removing");

    return (
      <Box mt={3}>
        <VisuallyHidden>Feed found.</VisuallyHidden>
        <FeedCard
          feed={{
            title: displayTitle,
            domain: hostname,
            description: feedUrl,
            url: feedUrl,
          }}
          state={feedCardState}
          onAdd={() => handleAdd(displayTitle)}
          onRemove={onFeedRemoved ? handleRemove : undefined}
          feedSettingsUrl={addedFeedId ? pages.userFeed(addedFeedId) : undefined}
          previewEnabled
          previewOpen={hasResolvedUrl}
          fullWidthAction
          redirectedFrom={redirectedFrom}
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
          <Alert status="warning" variant="left-accent" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Couldn&apos;t find a feed</AlertTitle>
              <AlertDescription>
                <Text fontSize="sm" mb={2}>
                  We couldn&apos;t detect a news feed at this URL. The site may not publish one.
                </Text>
                <Button size="sm" variant="outline" onClick={onTrySearchByName}>
                  Try searching by name instead
                </Button>
              </AlertDescription>
            </Box>
          </Alert>

          <Box
            mt={3}
            borderWidth="1px"
            borderColor="whiteAlpha.200"
            borderRadius="md"
            bg="gray.700"
            px={4}
            py={3}
          >
            <Text as="h3" fontWeight="semibold" fontSize="sm" mb={2}>
              Tips for finding feeds
            </Text>
            <Box as="ul" pl={4} fontSize="sm" color="gray.300">
              <Box as="li" mb={1}>
                Double-check the URL for typos or missing parts
              </Box>
              <Box as="li" mb={1}>
                Look for an RSS icon or &quot;Subscribe&quot; link on the website
              </Box>
              <Box as="li">Search Google for the site name + &quot;RSS feed&quot;</Box>
            </Box>
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
