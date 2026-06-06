import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Box,
  HStack,
  Icon,
  Text,
  Badge,
  Button,
  Spinner,
  Link,
  Skeleton,
  List,
  Highlight,
  VisuallyHidden,
  chakra,
} from "@chakra-ui/react";
import {
  FaPlus,
  FaCheck,
  FaChevronDown,
  FaChevronUp,
  FaXmark,
  FaArrowsRotate,
  FaGear,
  FaTriangleExclamation,
} from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { getAvatarColor } from "@/utils/getAvatarColor";
import { getCuratedFeedErrorMessage } from "./getCuratedFeedErrorMessage";
import { getPreviewErrorMessage } from "./getPreviewErrorMessage";
import { useCuratedFeedPreview } from "../../hooks/useCuratedFeedPreview";
import type { GetCuratedFeedPreviewOutput } from "../../api/getCuratedFeedPreview";

dayjs.extend(relativeTime);

interface FeedCardProps {
  feed: {
    title: string;
    domain: string;
    description: string;
    popular?: boolean;
    url?: string;
    id?: string;
  };
  state: "default" | "adding" | "added" | "error" | "remove-error" | "limit-reached" | "removing";
  onAdd: () => void;
  onRemove?: () => void;
  errorMessage?: string;
  errorCode?: string;
  isCurated?: boolean;
  showPopularBadge?: boolean;
  showDomain?: boolean;
  showCategoryTag?: string;
  feedSettingsUrl?: string;
  previewEnabled?: boolean;
  previewOpen?: boolean;
  hideActions?: boolean;
  fullWidthAction?: boolean;
  borderless?: boolean;
  searchQuery?: string;
  wrapDescription?: boolean;
  redirectedFrom?: string;
}

export const FeedCard = ({
  feed,
  state,
  onAdd,
  onRemove,
  errorMessage,
  errorCode,
  isCurated,
  showPopularBadge = true,
  showDomain = true,
  showCategoryTag,
  feedSettingsUrl,
  previewEnabled = false,
  previewOpen = false,
  hideActions = false,
  fullWidthAction = false,
  borderless = false,
  searchQuery,
  wrapDescription = false,
  redirectedFrom,
}: FeedCardProps) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(previewOpen);
  const [previewError, setPreviewError] = useState(false);
  const [cachedPreview, setCachedPreview] = useState<GetCuratedFeedPreviewOutput | null>(null);
  const {
    mutateAsync: fetchPreviewMutation,
    status: previewStatus,
    data: previewData,
  } = useCuratedFeedPreview();
  const fetchPreview = useCallback(
    () => fetchPreviewMutation({ details: { curatedFeedId: feed.id! } }),
    [feed.id, fetchPreviewMutation],
  );
  const initialFetchDone = useRef(false);
  const prevStateRef = useRef(state);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState("");

  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = state;

    if (prevState === "removing" && state === "default") {
      setStatusAnnouncement(`${feed.title} feed removed`);
      wasRemovingRef.current = false;
      requestAnimationFrame(() => {
        addButtonRef.current?.focus();
      });
    } else if (prevState === "adding" && state === "added") {
      setStatusAnnouncement(`${feed.title} feed added`);
    } else if (prevState !== state) {
      setStatusAnnouncement("");
    }
  }, [state, feed.title]);

  useEffect(() => {
    if (previewOpen && previewEnabled && !initialFetchDone.current) {
      initialFetchDone.current = true;

      fetchPreview()
        .then((result) => setCachedPreview(result))
        .catch(() => setPreviewError(true));
    }
  }, [previewOpen, previewEnabled, fetchPreview]);

  const uniqueId = useId();
  const errorId = `feed-error-${uniqueId}`;
  const errorDetailsId = `feed-error-details-${uniqueId}`;
  const previewId = `feed-preview-${uniqueId}`;

  const displayErrorMessage =
    state === "error" && isCurated
      ? getCuratedFeedErrorMessage(errorCode)
      : errorMessage || "Failed to add feed";

  const removeErrorMessage =
    state === "remove-error" ? errorMessage || "Failed to remove feed" : undefined;

  const isAdded = state === "added" || state === "remove-error";
  const isAdding = state === "adding";
  const isRemoving = state === "removing";
  const isAddable = state === "default" || isAdding || isAdded || isRemoving;
  const hasSettingsLink = isAdded && !!feedSettingsUrl;

  // Keep the separate remove button mounted for one render after removal completes
  // (removing → default) so focus doesn't fall to <body> and trigger a document title
  // announcement. The useEffect moves focus to addButtonRef, then clears the ref.
  const wasRemovingRef = useRef(false);
  if (isRemoving) wasRemovingRef.current = true;
  if (state !== "default" && state !== "removing") wasRemovingRef.current = false;

  const showRemoveAsSeparateButton =
    wasRemovingRef.current || (onRemove && isAdded && hasSettingsLink);

  // Use a single button for different states to maintain focus for accessibility
  type MainButtonMode = "add" | "adding" | "added-disabled" | "remove" | "removing" | "settings";
  const mainButtonMode: MainButtonMode = (() => {
    if (isRemoving && showRemoveAsSeparateButton) return "settings";
    if (isRemoving) return "removing";
    if (isAdding) return "adding";
    if (hasSettingsLink) return "settings";
    if (isAdded && onRemove) return "remove";
    if (isAdded) return "added-disabled";

    return "add";
  })();

  const mainButtonLabel: Record<MainButtonMode, string> = {
    add: `Add ${feed.title} feed`,
    adding: `Adding ${feed.title} feed...`,
    "added-disabled": `${feed.title} feed added`,
    remove: `Remove ${feed.title} feed`,
    removing: `Removing ${feed.title} feed...`,
    settings: `Go to feed settings for ${feed.title}`,
  };

  const handleAddButtonClick = (e: React.MouseEvent) => {
    switch (mainButtonMode) {
      case "add":
        onAdd();
        break;
      case "remove":
        onRemove?.();
        break;
      case "settings":
        navigate(feedSettingsUrl!);
        break;
      default:
        e.preventDefault();
    }
  };

  const handleRetryPreview = useCallback(async () => {
    setPreviewError(false);

    try {
      const result = await fetchPreview();
      setCachedPreview(result);
    } catch {
      setPreviewError(true);
    }
  }, [fetchPreview]);

  const resolvedPreview = cachedPreview || previewData;
  const previewArticles = resolvedPreview?.result.articles;
  const previewRequestStatus = resolvedPreview?.result.requestStatus;
  const previewResponseStatusCode = resolvedPreview?.result.responseStatusCode;
  const isPreviewLoading = previewStatus === "loading" && !cachedPreview;
  const isPreviewError =
    previewError || (previewRequestStatus && previewRequestStatus !== "SUCCESS");
  const previewErrorMessage = isPreviewError
    ? getPreviewErrorMessage(previewRequestStatus ?? undefined, previewResponseStatusCode)
    : undefined;

  return (
    <Box
      as="article"
      bg="bg.panel"
      borderWidth={borderless ? 0 : "1px"}
      borderColor={state === "error" || state === "remove-error" ? "red.400" : "border"}
      borderRadius={borderless ? 0 : "l3"}
      p={3}
      aria-label={feed.title}
    >
      <HStack gap={3} align="start" flexWrap="wrap">
        <Box flexShrink={0} opacity={state === "added" || state === "removing" ? 0.7 : 1}>
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
              <Text color="fg" fontSize="sm" fontWeight="bold" lineHeight="1" aria-hidden="true">
                {feed.title.charAt(0).toUpperCase()}
              </Text>
            </Box>
          ) : (
            <Box
              w="32px"
              h="32px"
              borderRadius="l3"
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
        <Box flex={1} minW="100px" opacity={state === "added" || state === "removing" ? 0.7 : 1}>
          <HStack gap={2} flexWrap="wrap">
            <Text fontWeight="bold" lineClamp={1} title={feed.title}>
              {searchQuery ? (
                <Highlight
                  query={searchQuery}
                  styles={{ bg: "yellow.700", color: "fg", px: "0", rounded: "none" }}
                >
                  {feed.title}
                </Highlight>
              ) : (
                feed.title
              )}
            </Text>
            {feed.popular && showPopularBadge && (
              <Badge
                colorPalette="purple"
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
                colorPalette="gray"
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
            <Text color="fg.muted" fontSize="xs" lineClamp={1}>
              {searchQuery ? (
                <Highlight
                  query={searchQuery}
                  styles={{ bg: "yellow.700", color: "fg", px: "0", rounded: "none" }}
                >
                  {feed.domain}
                </Highlight>
              ) : (
                feed.domain
              )}
            </Text>
          )}
          {redirectedFrom && (
            <Text color="fg.muted" fontSize="xs" lineClamp={1} title={redirectedFrom}>
              Originally entered: {redirectedFrom}
            </Text>
          )}
          {feed.description && (
            <Text color="fg.muted" lineClamp={wrapDescription ? undefined : 1} fontSize="sm">
              {searchQuery ? (
                <Highlight
                  query={searchQuery}
                  styles={{ bg: "yellow.700", color: "fg", px: "0", rounded: "none" }}
                >
                  {feed.description}
                </Highlight>
              ) : (
                feed.description
              )}
            </Text>
          )}
        </Box>
        {!hideActions && !fullWidthAction && (
          <Box flexShrink={0} ml="auto">
            {isAddable && (
              <HStack gap={2}>
                <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
                  {statusAnnouncement}
                </VisuallyHidden>
                {isAdded && !onRemove && (
                  <HStack gap={1} color="text.success">
                    <FaCheck aria-hidden="true" />
                    <Text fontSize="xs">Added</Text>
                  </HStack>
                )}
                {showRemoveAsSeparateButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={isRemoving ? (e) => e.preventDefault() : onRemove}
                    aria-label={
                      isRemoving ? `Removing ${feed.title} feed...` : `Remove ${feed.title} feed`
                    }
                    aria-busy={isRemoving || undefined}
                    aria-disabled={isRemoving || undefined}
                  >
                    {isRemoving ? (
                      <>
                        <Spinner size="xs" mr={1} /> Removing...
                      </>
                    ) : (
                      <>
                        <FaXmark aria-hidden="true" /> Remove
                      </>
                    )}
                  </Button>
                )}
                <Button
                  ref={addButtonRef}
                  size="sm"
                  onClick={handleAddButtonClick}
                  aria-label={mainButtonLabel[mainButtonMode]}
                  aria-busy={
                    mainButtonMode === "adding" || mainButtonMode === "removing" || undefined
                  }
                  aria-disabled={
                    (mainButtonMode !== "add" &&
                      mainButtonMode !== "remove" &&
                      mainButtonMode !== "settings") ||
                    undefined
                  }
                  variant={mainButtonMode === "remove" ? "outline" : undefined}
                >
                  {mainButtonMode === "adding" && <Spinner size="xs" />}
                  {mainButtonMode === "removing" && (
                    <>
                      <Spinner size="xs" mr={1} /> Removing...
                    </>
                  )}
                  {mainButtonMode === "remove" && (
                    <>
                      <FaXmark aria-hidden="true" /> Remove
                    </>
                  )}
                  {mainButtonMode === "settings" && (
                    <>
                      <FaGear aria-hidden="true" /> Feed settings &rarr;
                    </>
                  )}
                  {mainButtonMode === "added-disabled" && (
                    <>
                      Added <FaCheck aria-hidden="true" />
                    </>
                  )}
                  {mainButtonMode === "add" && (
                    <>
                      <FaPlus aria-hidden="true" /> Add
                    </>
                  )}
                </Button>
              </HStack>
            )}
            {state === "error" && (
              <Button size="sm" onClick={onAdd} aria-describedby={errorId}>
                <FaArrowsRotate aria-hidden="true" /> Retry
              </Button>
            )}
            {state === "limit-reached" && (
              <Button
                size="sm"
                variant="outline"
                color="fg.subtle"
                borderColor="border"
                cursor="not-allowed"
                _hover={{}}
                _active={{}}
                aria-label={`Add ${feed.title} feed, disabled, feed limit reached`}
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
              >
                Limit reached
              </Button>
            )}
          </Box>
        )}
      </HStack>
      {state === "error" && (
        <Box mt={2}>
          <HStack gap={2} align="start">
            <Icon as={FaTriangleExclamation} color="text.error" mt="2px" aria-hidden="true" />
            <Box>
              <Text color="text.error" fontSize="sm" role="alert" id={errorId} display="inline">
                {displayErrorMessage}
              </Text>
              {isCurated && errorMessage && (
                <Button
                  variant="plain"
                  textDecoration="underline"
                  fontSize="xs"
                  color="fg.muted"
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
          {isCurated && errorMessage && (
            <Box
              id={errorDetailsId}
              mt={2}
              pl={6}
              fontSize="xs"
              color="fg.muted"
              hidden={!showDetails}
              as="dl"
            >
              <HStack gap={1} align="baseline">
                <Text as="dt" fontWeight="semibold" color="fg.subtle" flexShrink={0}>
                  Error
                </Text>
                <Text as="dd">{errorMessage}</Text>
              </HStack>
            </Box>
          )}
        </Box>
      )}
      {state === "remove-error" && (
        <Box mt={2}>
          <HStack gap={2} align="start">
            <Icon as={FaTriangleExclamation} color="text.error" mt="2px" aria-hidden="true" />
            <Text color="text.error" fontSize="sm" role="alert">
              {removeErrorMessage}
            </Text>
          </HStack>
        </Box>
      )}
      {!hideActions && fullWidthAction && (
        <Box mt={3}>
          {isAddable && (
            <>
              <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
                {statusAnnouncement}
              </VisuallyHidden>
              {isAdded && !onRemove && (
                <HStack gap={1} color="text.success" mb={2} justify="center">
                  <FaCheck aria-hidden="true" />
                  <Text fontSize="sm">Added</Text>
                </HStack>
              )}
              <Button
                ref={addButtonRef}
                colorPalette={mainButtonMode === "remove" ? undefined : "brand"}
                width="full"
                onClick={handleAddButtonClick}
                variant={
                  mainButtonMode === "remove" || mainButtonMode === "added-disabled"
                    ? "outline"
                    : "solid"
                }
                aria-label={mainButtonLabel[mainButtonMode]}
                aria-busy={
                  mainButtonMode === "adding" || mainButtonMode === "removing" || undefined
                }
                aria-disabled={
                  (mainButtonMode !== "add" &&
                    mainButtonMode !== "remove" &&
                    mainButtonMode !== "settings") ||
                  undefined
                }
              >
                {mainButtonMode === "adding" && (
                  <>
                    <Spinner size="xs" mr={2} /> Adding...
                  </>
                )}
                {mainButtonMode === "removing" && (
                  <>
                    <Spinner size="xs" mr={2} /> Removing...
                  </>
                )}
                {mainButtonMode === "remove" && (
                  <>
                    <FaXmark aria-hidden="true" /> Remove
                  </>
                )}
                {mainButtonMode === "settings" && (
                  <>
                    <FaGear aria-hidden="true" /> Go to feed settings &rarr;
                  </>
                )}
                {mainButtonMode === "added-disabled" && (
                  <>
                    Added <FaCheck aria-hidden="true" />
                  </>
                )}
                {mainButtonMode === "add" && (
                  <>
                    <FaPlus aria-hidden="true" /> Add Feed
                  </>
                )}
              </Button>
              {showRemoveAsSeparateButton && (
                <Button
                  variant="outline"
                  width="full"
                  mt={2}
                  onClick={isRemoving ? (e) => e.preventDefault() : onRemove}
                  aria-label={
                    isRemoving ? `Removing ${feed.title} feed...` : `Remove ${feed.title} feed`
                  }
                  aria-busy={isRemoving || undefined}
                  aria-disabled={isRemoving || undefined}
                >
                  {isRemoving ? (
                    <>
                      <Spinner size="xs" mr={2} /> Removing...
                    </>
                  ) : (
                    <>
                      <FaXmark aria-hidden="true" /> Remove
                    </>
                  )}
                </Button>
              )}
            </>
          )}
          {state === "error" && (
            <PrimaryActionButton width="full" onClick={onAdd} aria-describedby={errorId}>
              <FaArrowsRotate aria-hidden="true" /> Retry
            </PrimaryActionButton>
          )}
          {state === "limit-reached" && (
            <Button
              width="full"
              variant="outline"
              color="fg.subtle"
              borderColor="border"
              cursor="not-allowed"
              _hover={{}}
              _active={{}}
              aria-label={`Add ${feed.title} feed, disabled, feed limit reached`}
              aria-disabled="true"
              onClick={(e) => e.preventDefault()}
            >
              Limit reached
            </Button>
          )}
        </Box>
      )}
      {previewEnabled && feed.id && (
        <chakra.details
          mt={2}
          open={isPreviewOpen || undefined}
          onToggle={(e: React.SyntheticEvent<HTMLDetailsElement>) => {
            const nowOpen = e.currentTarget.open;

            if (nowOpen !== isPreviewOpen) {
              setIsPreviewOpen(nowOpen);

              if (nowOpen && !cachedPreview) {
                setPreviewError(false);
                fetchPreview()
                  .then((result) => setCachedPreview(result))
                  .catch(() => setPreviewError(true));
              }
            }
          }}
          css={{
            "& > summary": {
              listStyle: "none",
            },
            "& > summary::-webkit-details-marker": {
              display: "none",
            },
          }}
        >
          <Box
            as="summary"
            cursor="pointer"
            py={1}
            fontSize="sm"
            color="text.link"
            _hover={{ color: "text.link" }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "brand.focusRing",
              outlineOffset: "2px",
              borderRadius: "sm",
            }}
            display="inline-flex"
            alignItems="center"
            gap={1}
            aria-label={`Preview articles for ${feed.title}`}
          >
            Preview articles
            {isPreviewOpen ? (
              <FaChevronUp aria-hidden="true" />
            ) : (
              <FaChevronDown aria-hidden="true" />
            )}
          </Box>
          {isPreviewOpen && (
            <Box
              mt={2}
              pt={2}
              borderTopWidth="1px"
              borderTopColor="border"
              role="region"
              aria-label={`${feed.title} article preview`}
            >
              {isPreviewLoading && (
                <Box aria-busy="true" aria-label="Loading article preview">
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mb={2}
                  >
                    Recent articles
                  </Text>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <HStack key={i} mb={2} justify="space-between">
                      <Skeleton height="14px" width={`${60 + (i % 3) * 10}%`} />
                      <Skeleton height="14px" width="70px" />
                    </HStack>
                  ))}
                </Box>
              )}
              {!isPreviewLoading && isPreviewError && (
                <HStack gap={2}>
                  <Text color="fg.muted" fontSize="sm" role="alert">
                    {previewErrorMessage}
                  </Text>
                  <Button size="xs" variant="outline" onClick={handleRetryPreview}>
                    Retry
                  </Button>
                </HStack>
              )}
              {!isPreviewLoading &&
                !isPreviewError &&
                previewArticles &&
                previewArticles.length === 0 && (
                  <Text color="fg.muted" fontSize="sm">
                    No articles found in this feed.
                  </Text>
                )}
              {!isPreviewLoading &&
                !isPreviewError &&
                previewArticles &&
                previewArticles.length > 0 && (
                  <>
                    <Text
                      id={previewId}
                      fontSize="xs"
                      color="fg.muted"
                      fontWeight="semibold"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      mb={2}
                    >
                      Recent articles
                    </Text>
                    <List.Root
                      listStyleType="none"
                      ml={0}
                      gap={2}
                      aria-labelledby={previewId}
                      role="list"
                    >
                      {previewArticles.map((article, index) => (
                        // eslint-disable-next-line react/no-array-index-key -- static preview list, never reordered
                        <List.Item key={index}>
                          <HStack justify="space-between" align="baseline" gap={3}>
                            {article.url ? (
                              <Link
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                color="fg"
                                fontSize="sm"
                                fontWeight="medium"
                                lineClamp={1}
                                _hover={{ color: "fg", textDecoration: "underline" }}
                                _focusVisible={{
                                  outline: "2px solid",
                                  outlineColor: "brand.focusRing",
                                  outlineOffset: "2px",
                                }}
                              >
                                {article.title}
                              </Link>
                            ) : (
                              <Text fontSize="sm" fontWeight="medium" lineClamp={1} color="fg">
                                {article.title}
                              </Text>
                            )}
                            {article.date && (
                              <chakra.time
                                dateTime={article.date}
                                fontSize="xs"
                                color="fg.muted"
                                flexShrink={0}
                                whiteSpace="nowrap"
                              >
                                {dayjs(article.date).fromNow()}
                              </chakra.time>
                            )}
                          </HStack>
                        </List.Item>
                      ))}
                    </List.Root>
                  </>
                )}
            </Box>
          )}
        </chakra.details>
      )}
    </Box>
  );
};
