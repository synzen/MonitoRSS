import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Box,
  HStack,
  Text,
  Badge,
  Button,
  Spinner,
  Link,
  Divider,
  Skeleton,
  UnorderedList,
  ListItem,
  Highlight,
} from "@chakra-ui/react";
import { CheckIcon, WarningIcon } from "@chakra-ui/icons";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { getAvatarColor } from "@/utils/getAvatarColor";

dayjs.extend(relativeTime);
import { getCuratedFeedErrorMessage } from "./getCuratedFeedErrorMessage";
import { getPreviewErrorMessage } from "./getPreviewErrorMessage";
import { useFeedPreviewByUrl } from "../../hooks/useFeedPreviewByUrl";
import type { GetFeedPreviewByUrlOutput } from "../../api/getFeedPreviewByUrl";

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
  previewEnabled?: boolean;
  previewOpen?: boolean;
  hideActions?: boolean;
  fullWidthAction?: boolean;
  borderless?: boolean;
  searchQuery?: string;
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
  previewEnabled = false,
  previewOpen = false,
  hideActions = false,
  fullWidthAction = false,
  borderless = false,
  searchQuery,
}: FeedCardProps) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(previewOpen);
  const [previewError, setPreviewError] = useState(false);
  const [cachedPreview, setCachedPreview] = useState<GetFeedPreviewByUrlOutput | null>(null);
  const {
    mutateAsync: fetchPreview,
    status: previewStatus,
    data: previewData,
  } = useFeedPreviewByUrl();
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (previewOpen && previewEnabled && !initialFetchDone.current) {
      initialFetchDone.current = true;

      fetchPreview({ details: { url: feed.url } })
        .then((result) => setCachedPreview(result))
        .catch(() => setPreviewError(true));
    }
  }, [previewOpen, previewEnabled, feed.url, fetchPreview]);

  const uniqueId = useId();
  const errorId = `feed-error-${uniqueId}`;
  const errorDetailsId = `feed-error-details-${uniqueId}`;
  const previewId = `feed-preview-${uniqueId}`;

  const displayErrorMessage =
    state === "error" && isCurated
      ? getCuratedFeedErrorMessage(errorCode)
      : errorMessage || "Failed to add feed";

  const isAddable = state === "default" || state === "adding" || state === "added";
  const isAdded = state === "added";
  const hasSettingsLink = isAdded && !!feedSettingsUrl;

  const getAddButtonLabel = () => {
    if (hasSettingsLink) return `Go to feed settings for ${feed.title}`;
    if (isAdded) return `${feed.title} feed added`;
    if (state === "adding") return `Adding ${feed.title} feed...`;
    return `Add ${feed.title} feed`;
  };

  const isAdding = state === "adding";

  const handleAddButtonClick = (e: React.MouseEvent) => {
    if (isAdding || (isAdded && !feedSettingsUrl)) {
      e.preventDefault();
    } else if (hasSettingsLink) {
      navigate(feedSettingsUrl!);
    } else {
      onAdd();
    }
  };

  const handleTogglePreview = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      const nextOpen = !isPreviewOpen;
      setIsPreviewOpen(nextOpen);

      if (nextOpen && !cachedPreview) {
        setPreviewError(false);

        try {
          const result = await fetchPreview({ details: { url: feed.url } });
          setCachedPreview(result);
        } catch {
          setPreviewError(true);
        }
      }
    },
    [isPreviewOpen, feed.url, fetchPreview, cachedPreview]
  );

  const handleRetryPreview = useCallback(async () => {
    setPreviewError(false);

    try {
      const result = await fetchPreview({ details: { url: feed.url } });
      setCachedPreview(result);
    } catch {
      setPreviewError(true);
    }
  }, [feed.url, fetchPreview]);

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
      bg="gray.800"
      borderWidth={borderless ? 0 : "1px"}
      borderColor={state === "error" ? "red.400" : "gray.600"}
      borderRadius={borderless ? 0 : "md"}
      p={3}
    >
      <HStack spacing={3} align="start">
        <Box flexShrink={0} opacity={state === "added" ? 0.7 : 1}>
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
              <Text color="white" fontSize="sm" fontWeight="bold" lineHeight="1" aria-hidden="true">
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

        <Box flex={1} minW={0} opacity={state === "added" ? 0.7 : 1}>
          <HStack spacing={2} flexWrap="wrap">
            <Text fontWeight="bold" noOfLines={1}>
              {searchQuery ? (
                <Highlight
                  query={searchQuery}
                  styles={{ bg: "yellow.700", color: "white", px: "0", rounded: "none" }}
                >
                  {feed.title}
                </Highlight>
              ) : (
                feed.title
              )}
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
              {searchQuery ? (
                <Highlight
                  query={searchQuery}
                  styles={{ bg: "yellow.700", color: "gray.100", px: "0", rounded: "none" }}
                >
                  {feed.domain}
                </Highlight>
              ) : (
                feed.domain
              )}
            </Text>
          )}
          {feed.description && (
            <Text color="gray.400" noOfLines={1} fontSize="sm">
              {searchQuery ? (
                <Highlight
                  query={searchQuery}
                  styles={{ bg: "yellow.700", color: "gray.100", px: "0", rounded: "none" }}
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
          <Box flexShrink={0}>
            {isAddable && (
              <HStack spacing={2}>
                <Box role="status">
                  {isAdded && (
                    <HStack spacing={1} color="green.300">
                      <CheckIcon boxSize={3} aria-hidden="true" />
                      <Text fontSize="xs">Added</Text>
                    </HStack>
                  )}
                </Box>
                <Button
                  size="sm"
                  onClick={handleAddButtonClick}
                  aria-label={getAddButtonLabel()}
                  aria-busy={isAdding || undefined}
                  aria-disabled={isAdding || (isAdded && !feedSettingsUrl) || undefined}
                >
                  {isAdding && <Spinner size="xs" />}
                  {hasSettingsLink && <>Feed settings &rarr;</>}
                  {isAdded && !feedSettingsUrl && (
                    <>
                      Added <CheckIcon ml={1} aria-hidden="true" />
                    </>
                  )}
                  {!isAdded && !isAdding && "+ Add"}
                </Button>
              </HStack>
            )}
            {state === "error" && (
              <Button size="sm" onClick={onAdd} aria-describedby={errorId}>
                Retry
              </Button>
            )}
            {state === "limit-reached" && (
              <Button
                size="sm"
                variant="outline"
                color="gray.300"
                borderColor="gray.500"
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

      {!hideActions && fullWidthAction && (
        <Box mt={3}>
          {isAddable && (
            <>
              <Box role="status">
                {isAdded && (
                  <HStack spacing={1} color="green.300" mb={2} justify="center">
                    <CheckIcon boxSize={3} aria-hidden="true" />
                    <Text fontSize="sm">Added</Text>
                  </HStack>
                )}
              </Box>
              <Button
                colorScheme="blue"
                width="full"
                onClick={handleAddButtonClick}
                variant={isAdded && !feedSettingsUrl ? "outline" : "solid"}
                aria-label={getAddButtonLabel()}
                aria-busy={isAdding || undefined}
                aria-disabled={isAdding || (isAdded && !feedSettingsUrl) || undefined}
              >
                {isAdding && (
                  <>
                    <Spinner size="xs" mr={2} /> Adding...
                  </>
                )}
                {hasSettingsLink && <>Go to feed settings &rarr;</>}
                {isAdded && !feedSettingsUrl && (
                  <>
                    Added <CheckIcon ml={2} aria-hidden="true" />
                  </>
                )}
                {!isAdded && !isAdding && "+ Add Feed"}
              </Button>
            </>
          )}
          {state === "error" && (
            <Button colorScheme="blue" width="full" onClick={onAdd} aria-describedby={errorId}>
              Retry
            </Button>
          )}
          {state === "limit-reached" && (
            <Button
              width="full"
              variant="outline"
              color="gray.300"
              borderColor="gray.500"
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

      {previewEnabled && (
        <Box
          as="details"
          mt={2}
          open={isPreviewOpen || undefined}
          onToggle={(e: React.SyntheticEvent<HTMLDetailsElement>) => {
            const nowOpen = e.currentTarget.open;
            if (nowOpen !== isPreviewOpen) {
              setIsPreviewOpen(nowOpen);
            }
          }}
          sx={{
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
            color="blue.300"
            _hover={{ color: "blue.200" }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "blue.400",
              outlineOffset: "2px",
              borderRadius: "sm",
            }}
            onClick={handleTogglePreview}
            display="inline-flex"
            alignItems="center"
            gap={1}
            aria-label={`Preview articles for ${feed.title}`}
          >
            Preview articles
            {isPreviewOpen ? (
              <ChevronUpIcon aria-hidden="true" />
            ) : (
              <ChevronDownIcon aria-hidden="true" />
            )}
          </Box>

          {isPreviewOpen && (
            <Box
              mt={2}
              pt={2}
              borderTopWidth="1px"
              borderTopColor="gray.700"
              role="region"
              aria-label={`${feed.title} article preview`}
            >
              {isPreviewLoading && (
                <Box aria-busy="true" aria-label="Loading article preview">
                  <Text
                    fontSize="xs"
                    color="gray.400"
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
                <HStack spacing={2}>
                  <Text color="gray.400" fontSize="sm" role="alert">
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
                  <Text color="gray.400" fontSize="sm">
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
                      color="gray.400"
                      fontWeight="semibold"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      mb={2}
                    >
                      Recent articles
                    </Text>
                    <UnorderedList
                      listStyleType="none"
                      ml={0}
                      spacing={2}
                      aria-labelledby={previewId}
                    >
                      {previewArticles.map((article, index) => (
                        <ListItem key={index}>
                          <HStack justify="space-between" align="baseline" spacing={3}>
                            {article.url ? (
                              <Link
                                href={article.url}
                                isExternal
                                color="gray.100"
                                fontSize="sm"
                                fontWeight="medium"
                                noOfLines={1}
                                _hover={{ color: "white", textDecoration: "underline" }}
                                _focusVisible={{
                                  outline: "2px solid",
                                  outlineColor: "blue.400",
                                  outlineOffset: "2px",
                                }}
                              >
                                {article.title}
                              </Link>
                            ) : (
                              <Text
                                fontSize="sm"
                                fontWeight="medium"
                                noOfLines={1}
                                color="gray.100"
                              >
                                {article.title}
                              </Text>
                            )}
                            {article.date && (
                              <Text
                                as="time"
                                dateTime={article.date}
                                fontSize="xs"
                                color="gray.400"
                                flexShrink={0}
                                whiteSpace="nowrap"
                              >
                                {dayjs(article.date).fromNow()}
                              </Text>
                            )}
                          </HStack>
                        </ListItem>
                      ))}
                    </UnorderedList>
                  </>
                )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
