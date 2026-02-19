import { useState } from "react";
import { Box, Text, Button, Spinner, HStack } from "@chakra-ui/react";
import { WarningIcon } from "@chakra-ui/icons";
import ApiAdapterError from "@/utils/ApiAdapterError";
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

      const feedTitle = validationData.result.feedTitle || resolvedHostname;

      return (
        <Box
          mt={3}
          role="group"
          aria-label="Feed found at a different URL"
          borderWidth="1px"
          borderColor="yellow.600"
          borderRadius="md"
          overflow="hidden"
        >
          <Box bg="yellow.900" px={3} py={2}>
            <HStack spacing={2} mb={2}>
              <WarningIcon color="yellow.400" aria-hidden="true" />
              <Text fontWeight="bold">We found a feed at a different URL</Text>
            </HStack>
            <Box as="dl" fontSize="sm">
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
          </Box>
          <FeedCard
            feed={{
              title: feedTitle,
              domain: resolvedHostname,
              description: validationData.result.resolvedToUrl!,
              url: feedUrl,
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
            previewEnabled
            previewOpen
            borderless
          />
          {addError && !isLimitReachedError && (
            <Box px={3} pb={2}>
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
          previewEnabled
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
