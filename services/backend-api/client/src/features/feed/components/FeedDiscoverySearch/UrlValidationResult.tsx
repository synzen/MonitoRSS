import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Text,
  Button,
  Spinner,
  HStack,
  Alert,
  VisuallyHidden,
} from "@chakra-ui/react";
import { Panel } from "@/components/Panel";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { CreateUserFeedUrlValidationOutput } from "../../api/createUserFeedUrlValidation";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { FixFeedRequestsCTA } from "../FixFeedRequestsCTA";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage copy";
import { pages } from "@/constants";
import { useCreateUserFeed } from "../../hooks";
import { useDeleteUserFeed } from "../../hooks/useDeleteUserFeed";
import { useUserMe } from "@/features/discordUser";
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
  const [removeError, setRemoveError] = useState<string | null>(null);
  const feedUrl = validationData?.result.resolvedToUrl || url;

  useEffect(() => {
    setAddedFeedId(null);
    setIsAdding(false);
    setIsRemoving(false);
    setAddError(null);
    setRemoveError(null);
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

    setRemoveError(null);
    setIsRemoving(true);

    try {
      await deleteFeed({ feedId: addedFeedId });
      setAddedFeedId(null);
      setIsRemoving(false);
      onFeedRemoved?.(feedUrl);
    } catch (err) {
      setIsRemoving(false);
      setRemoveError((err as Error).message || "Failed to remove feed");
    }
  }, [addedFeedId, isRemoving, deleteFeed, onFeedRemoved, feedUrl]);

  const isLimitReachedError =
    addError?.errorCode === ApiErrorCode.FEED_LIMIT_REACHED;
  const isRedditConnectionRequiredAddError =
    addError?.errorCode === ApiErrorCode.REDDIT_CONNECTION_REQUIRED;

  const { data: userMeData } = useUserMe();
  const hasRedditConnected =
    userMeData?.result.externalAccounts?.find((e) => e.type === "reddit")
      ?.status === "ACTIVE";

  // Re-run the blocked action once Reddit connects. The connect button lives inside
  // FixFeedRequestsCTA, which unmounts the instant the account becomes active - so the retry can't
  // be driven from there (its callback would race its own unmount). This component survives the
  // transition, so it owns the retry: on the not-connected -> connected edge, re-validate (URL gate)
  // or re-add (add-time gate), whichever Reddit gate is currently showing.
  const isRedditValidationGate =
    validationStatus === "error" &&
    validationError?.errorCode === ApiErrorCode.REDDIT_CONNECTION_REQUIRED;
  const prevHasRedditConnectedRef = useRef(hasRedditConnected);

  useEffect(() => {
    const justConnected =
      hasRedditConnected && !prevHasRedditConnectedRef.current;
    prevHasRedditConnectedRef.current = hasRedditConnected;

    if (!justConnected) return;

    if (isRedditValidationGate) {
      onRetryValidation();
    } else if (isRedditConnectionRequiredAddError) {
      setAddError(null);
      handleAdd(validationData?.result.feedTitle);
    }
  }, [hasRedditConnected]);

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
        <HStack gap={2}>
          <Spinner size="sm" />
          <Text>Checking URL...</Text>
        </HStack>
        <Text fontSize="sm" color="fg.muted">
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
          feedSettingsUrl={
            addedFeedId ? pages.userFeed(addedFeedId) : undefined
          }
          fullWidthAction
          redirectedFrom={redirectedFrom}
        />
        {addError &&
          !isLimitReachedError &&
          !isRedditConnectionRequiredAddError && (
            <Box mt={2}>
              <InlineErrorAlert
                title="Failed to add feed"
                description={addError.message}
              />
            </Box>
          )}
        {isRedditConnectionRequiredAddError && (
          <Box mt={2}>
            <FixFeedRequestsCTA
              url={feedUrl}
              variant="required"
              onCorrected={() => {
                setAddError(null);
                handleAdd(displayTitle);
              }}
            />
          </Box>
        )}
        {removeError && (
          <Box mt={2}>
            <InlineErrorAlert
              title="Failed to remove feed"
              description={removeError}
            />
          </Box>
        )}
      </Box>
    );
  }

  if (validationStatus === "error" && validationError) {
    if (validationError.errorCode === ApiErrorCode.REDDIT_CONNECTION_REQUIRED) {
      return (
        <Box mt={3}>
          <FixFeedRequestsCTA
            url={url}
            variant="required"
            onCorrected={onRetryValidation}
          />
        </Box>
      );
    }

    const isNoFeedFound =
      validationError.errorCode &&
      NO_FEED_FOUND_CODES.includes(validationError.errorCode);

    if (isNoFeedFound) {
      return (
        <Box mt={3}>
          <Alert.Root status="warning" variant="subtle">
            <Alert.Indicator />
            <Box>
              <Alert.Title>Couldn&apos;t find a feed</Alert.Title>
              <Alert.Description>
                <Text fontSize="sm" mb={2} color="fg">
                  We couldn&apos;t detect a news feed at this URL. The site may
                  not publish one.
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="colorPalette.solid"
                  onClick={onTrySearchByName}
                >
                  Try searching by name instead
                </Button>
              </Alert.Description>
            </Box>
          </Alert.Root>
          <Panel mt={3} px={4} py={3}>
            <Text as="h3" fontWeight="semibold" fontSize="sm" mb={2}>
              Tips for finding feeds
            </Text>
            <Box
              as="ul"
              pl={5}
              fontSize="sm"
              color="fg.muted"
              listStyleType="disc"
              listStylePosition="outside"
            >
              <Box as="li" mb={1}>
                Double-check the URL for typos or missing parts
              </Box>
              <Box as="li" mb={1}>
                Look for an RSS icon or &quot;Subscribe&quot; link on the
                website
              </Box>
              <Box as="li">
                Search Google for the site name + &quot;RSS feed&quot;
              </Box>
            </Box>
          </Panel>
        </Box>
      );
    }

    return (
      <Box mt={3}>
        <InlineErrorAlert
          title="Failed to validate feed"
          description={validationError.message}
        />
        <FixFeedRequestsCTA url={url} onCorrected={onRetryValidation} />
      </Box>
    );
  }

  return null;
};
