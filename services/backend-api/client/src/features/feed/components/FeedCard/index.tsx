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
import { Link as RouterLink } from "react-router-dom";
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
  borderless = false,
  searchQuery,
}: FeedCardProps) => {
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

        <Box flex={1} minW={0}>
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

        {!hideActions && (
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
              <Button
                size="sm"
                variant="outline"
                color="gray.500"
                borderColor="gray.600"
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
