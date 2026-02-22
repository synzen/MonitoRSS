import { useCallback, useEffect, useRef, useState } from "react";
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
import { CheckIcon, WarningIcon } from "@chakra-ui/icons";
import { useNavigate } from "react-router-dom";
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

interface ResolvedFeedActionsProps {
  sectionAriaLabel: string;
  borderColor: string;
  bannerBg: string;
  resolvedAnnouncement: string;
  buttonState: "default" | "limit" | "adding" | "added" | "limit-error" | "removing";
  feedTitle: string;
  handleAdd: () => void;
  handleRemove: () => void;
  onFeedRemoved?: (feedUrl: string) => void;
  addError: ApiAdapterError | null;
  isLimitReachedError: boolean;
  resolvedHostname: string;
  resolvedToUrl: string;
  feedUrl: string;
  addedFeedId: string | null;
  children: React.ReactNode;
}

const ResolvedFeedActions = ({
  sectionAriaLabel,
  borderColor,
  bannerBg,
  resolvedAnnouncement,
  buttonState,
  feedTitle,
  handleAdd,
  handleRemove,
  onFeedRemoved,
  addError,
  isLimitReachedError,
  resolvedHostname,
  resolvedToUrl,
  feedUrl,
  addedFeedId,
  children,
}: ResolvedFeedActionsProps) => {
  const navigate = useNavigate();
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const prevButtonStateRef = useRef(buttonState);

  const wasRemovingRef = useRef(false);
  if (buttonState === "removing") wasRemovingRef.current = true;
  if (buttonState !== "default" && buttonState !== "removing") wasRemovingRef.current = false;

  useEffect(() => {
    const prev = prevButtonStateRef.current;
    prevButtonStateRef.current = buttonState;

    if (prev === "removing" && buttonState === "default") {
      wasRemovingRef.current = false;
      requestAnimationFrame(() => {
        mainButtonRef.current?.focus();
      });
    }
  }, [buttonState]);

  const showRemoveButton =
    wasRemovingRef.current || (buttonState === "added" && onFeedRemoved && addedFeedId);

  type MainButtonMode =
    | "add"
    | "adding"
    | "added-disabled"
    | "remove"
    | "removing"
    | "settings"
    | "limit";
  const mainButtonMode: MainButtonMode = (() => {
    if (buttonState === "limit" || buttonState === "limit-error") return "limit";
    if (buttonState === "removing" && showRemoveButton) return "settings";
    if (buttonState === "removing") return "removing";
    if (buttonState === "adding") return "adding";
    if (buttonState === "added" && addedFeedId) return "settings";
    if (buttonState === "added" && onFeedRemoved) return "remove";
    if (buttonState === "added") return "added-disabled";
    return "add";
  })();

  const mainButtonLabel: Record<MainButtonMode, string> = {
    add: `Add ${feedTitle} feed`,
    adding: `Adding ${feedTitle} feed...`,
    "added-disabled": `${feedTitle} feed added`,
    remove: `Remove ${feedTitle} feed`,
    removing: `Removing ${feedTitle} feed...`,
    settings: `Go to feed settings for ${feedTitle}`,
    limit: `Add ${feedTitle} feed, disabled, feed limit reached`,
  };

  const handleMainButtonClick = (e: React.MouseEvent) => {
    switch (mainButtonMode) {
      case "add":
        handleAdd();
        break;
      case "remove":
        handleRemove();
        break;
      case "settings":
        navigate(pages.userFeed(addedFeedId!));
        break;
      default:
        e.preventDefault();
    }
  };

  const isInteractive =
    mainButtonMode === "add" || mainButtonMode === "remove" || mainButtonMode === "settings";

  return (
    <Box
      as="section"
      mt={3}
      aria-label={sectionAriaLabel}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      overflow="hidden"
    >
      <Box bg={bannerBg} px={3} py={2}>
        {children}
        <VisuallyHidden role="status">{resolvedAnnouncement}</VisuallyHidden>
        <Box mt={3}>
          <Button
            ref={mainButtonRef}
            width="full"
            onClick={handleMainButtonClick}
            aria-label={mainButtonLabel[mainButtonMode]}
            aria-live="off"
            aria-disabled={!isInteractive || undefined}
            colorScheme={mainButtonMode === "limit" ? undefined : "blue"}
            variant={
              mainButtonMode === "remove" ||
              mainButtonMode === "added-disabled" ||
              mainButtonMode === "removing" ||
              mainButtonMode === "limit"
                ? "outline"
                : "solid"
            }
            color={mainButtonMode === "limit" ? "gray.300" : undefined}
            borderColor={mainButtonMode === "limit" ? "gray.500" : undefined}
            cursor={mainButtonMode === "limit" ? "not-allowed" : undefined}
            _hover={mainButtonMode === "limit" ? {} : undefined}
            _active={mainButtonMode === "limit" ? {} : undefined}
          >
            {(mainButtonMode === "adding" || mainButtonMode === "removing") && (
              <Spinner size="xs" mr={2} />
            )}
            {mainButtonMode === "added-disabled" && <CheckIcon ml={2} aria-hidden="true" />}
            {
              {
                add: "+ Add this feed",
                adding: "Adding...",
                settings: "Go to feed settings \u2192",
                "added-disabled": "Added",
                remove: "Remove",
                removing: "Removing...",
                limit: "Limit reached",
              }[mainButtonMode]
            }
          </Button>
          {showRemoveButton && (
            <Button
              variant="outline"
              width="full"
              mt={2}
              aria-label={
                buttonState === "removing"
                  ? `Removing ${feedTitle} feed...`
                  : `Remove ${feedTitle} feed`
              }
              aria-live="off"
              aria-disabled={buttonState === "removing" || undefined}
              onClick={buttonState === "removing" ? (e) => e.preventDefault() : handleRemove}
            >
              {buttonState === "removing" ? (
                <>
                  <Spinner size="xs" mr={2} /> Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          )}
        </Box>
        {addError && !isLimitReachedError && (
          <Box mt={2}>
            <InlineErrorAlert title="Failed to add feed" description={addError.message} />
          </Box>
        )}
      </Box>
      <FeedCard
        feed={{
          title: feedTitle,
          domain: resolvedHostname,
          description: resolvedToUrl,
          url: feedUrl,
        }}
        state="default"
        onAdd={handleAdd}
        feedSettingsUrl={addedFeedId ? pages.userFeed(addedFeedId) : undefined}
        previewEnabled
        previewOpen
        borderless
        hideActions
      />
    </Box>
  );
};

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
  const prevButtonStateRef = useRef(buttonState);
  const [resolvedAnnouncement, setResolvedAnnouncement] = useState("");

  useEffect(() => {
    const prev = prevButtonStateRef.current;
    prevButtonStateRef.current = buttonState;

    if (prev === "removing" && buttonState === "default") {
      setResolvedAnnouncement("Feed removed");
    } else if (prev === "adding" && buttonState === "added") {
      setResolvedAnnouncement("Feed added");
    } else if (prev !== buttonState) {
      setResolvedAnnouncement("");
    }
  }, [buttonState]);

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

      const displayTitle = validationData.result.feedTitle || resolvedHostname;

      if (isExpectedResolutionUrl(url)) {
        return (
          <ResolvedFeedActions
            sectionAriaLabel="Feed found"
            borderColor="blue.600"
            bannerBg="blue.900"
            resolvedAnnouncement={resolvedAnnouncement}
            buttonState={buttonState}
            feedTitle={displayTitle}
            handleAdd={() => handleAdd(validationData.result.feedTitle)}
            handleRemove={handleRemove}
            onFeedRemoved={onFeedRemoved}
            addError={addError}
            isLimitReachedError={isLimitReachedError}
            resolvedHostname={resolvedHostname}
            resolvedToUrl={validationData.result.resolvedToUrl!}
            feedUrl={feedUrl}
            addedFeedId={addedFeedId}
          >
            <HStack spacing={2} mb={2}>
              <CheckIcon color="green.400" aria-hidden="true" />
              <Text fontWeight="bold">Feed found</Text>
            </HStack>
            <Box as="dl" fontSize="sm">
              <HStack spacing={1} align="baseline">
                <Text as="dt" fontWeight="semibold" color="gray.300" flexShrink={0}>
                  Feed URL:
                </Text>
                <Text as="dd" color="gray.100" wordBreak="break-all">
                  {validationData.result.resolvedToUrl}
                </Text>
              </HStack>
            </Box>
          </ResolvedFeedActions>
        );
      }

      return (
        <ResolvedFeedActions
          sectionAriaLabel="Feed found at a different URL"
          borderColor="yellow.600"
          bannerBg="yellow.900"
          resolvedAnnouncement={resolvedAnnouncement}
          buttonState={buttonState}
          feedTitle={displayTitle}
          handleAdd={() => handleAdd(validationData.result.feedTitle)}
          handleRemove={handleRemove}
          onFeedRemoved={onFeedRemoved}
          addError={addError}
          isLimitReachedError={isLimitReachedError}
          resolvedHostname={resolvedHostname}
          resolvedToUrl={validationData.result.resolvedToUrl!}
          feedUrl={feedUrl}
          addedFeedId={addedFeedId}
        >
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
        </ResolvedFeedActions>
      );
    }

    let hostname: string;

    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }

    const displayTitle = validationData.result.feedTitle || hostname;

    return (
      <Box mt={3}>
        <FeedCard
          feed={{
            title: displayTitle,
            domain: hostname,
            description: url,
            url,
          }}
          state={
            buttonState === "removing"
              ? "removing"
              : buttonState === "default"
              ? "default"
              : buttonState === "adding"
              ? "adding"
              : buttonState === "added"
              ? "added"
              : "limit-reached"
          }
          onAdd={() => handleAdd(validationData.result.feedTitle)}
          onRemove={onFeedRemoved ? handleRemove : undefined}
          errorMessage={addError && !isLimitReachedError ? "Failed to add feed" : undefined}
          feedSettingsUrl={addedFeedId ? pages.userFeed(addedFeedId) : undefined}
          previewEnabled
          fullWidthAction
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
