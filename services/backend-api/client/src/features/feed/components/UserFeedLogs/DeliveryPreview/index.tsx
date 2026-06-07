import { Alert, Box, Flex, Heading, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import { FaArrowsRotate } from "react-icons/fa6";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { useUserFeedContext } from "../../../contexts/UserFeedContext";
import { useFeedScope } from "../../../contexts/FeedScopeContext";
import { pages } from "../../../../../constants";
import { UserFeedTabSearchParam } from "../../../../../constants/userFeedTabSearchParam";
import { useDeliveryPreviewWithPagination } from "../../../hooks/useDeliveryPreviewWithPagination";
import { useUserFeedRequests } from "../../../hooks";
import { InlineErrorAlert } from "../../../../../components";
import {
  DeliveryPreviewAccordion,
  DeliveryPreviewAccordionSkeleton,
} from "./DeliveryPreviewAccordion";
import { ArticleDeliveryOutcome, ArticleDeliveryResult } from "../../../types/DeliveryPreview";
import {
  formatRefreshRateSeconds,
  getEffectiveRefreshRateSeconds,
  getNextCheckText,
} from "../../../../../utils/formatRefreshRateSeconds";
import { FeedLevelStateDisplay, FeedState } from "./FeedLevelStateDisplay";

dayjs.extend(relativeTime);

export const getPatternAlert = (
  results: ArticleDeliveryResult[],
  refreshRateSeconds: number,
  nextRetryAtIso?: string | null,
): { type: "info" | "warning"; message: string } | null => {
  if (results.length === 0) return null;

  const outcomeCounts = results.reduce(
    (acc, r) => {
      const outcome = r.outcome as ArticleDeliveryOutcome;
      acc[outcome] = (acc[outcome] || 0) + 1;

      return acc;
    },
    {} as Record<string, number>,
  );

  const totalResults = results.length;
  const dominantOutcome = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1])[0];

  if (!dominantOutcome) return null;

  const [outcome, count] = dominantOutcome;
  const percentage = count / totalResults;

  // First run is a feed-level state - if any article has it, all do
  if (outcome === ArticleDeliveryOutcome.FirstRunBaseline && count >= 1) {
    const formattedTime = formatRefreshRateSeconds(refreshRateSeconds);
    const nextCheckText = getNextCheckText(nextRetryAtIso);
    const nextCheckSuffix = nextCheckText ? ` ${nextCheckText}` : "";

    return {
      type: "info",
      message: `This feed is in its learning phase. MonitoRSS is identifying existing articles so it only delivers new ones. This typically completes within ${formattedTime}.${nextCheckSuffix}`,
    };
  }

  if (outcome === ArticleDeliveryOutcome.RateLimitedFeed && percentage > 0.5) {
    return {
      type: "warning",
      message:
        "Your feed has delivered the maximum articles allowed in a 24-hour period. Delivery resumes automatically as older deliveries fall outside this window-no action needed.",
    };
  }

  if (outcome === ArticleDeliveryOutcome.DuplicateId && percentage === 1) {
    return {
      type: "info",
      message:
        "All articles in this feed have already been processed. MonitoRSS only delivers articles the first time they appear. New articles will be sent automatically when they're published to your feed.",
    };
  }

  // FeedUnchanged is a feed-level state - if any article has it, all do
  if (outcome === ArticleDeliveryOutcome.FeedUnchanged && count >= 1) {
    return {
      type: "info",
      message:
        "The feed's content hasn't changed since it was last checked. MonitoRSS skips unchanged feeds to save resources. Articles will be delivered automatically when new content is detected.",
    };
  }

  return null;
};

export interface DeliveryPreviewPresentationalProps {
  isLoading?: boolean;
  error?: Error | null;
  isFetching?: boolean;
  results?: ArticleDeliveryResult[];
  total?: number;
  hasMore?: boolean;
  hasNoConnections?: boolean;
  feedState?: FeedState | null;
  refreshRateSeconds: number;
  nextRetryAtIso?: string | null;
  nextRetryReason?: "REFRESH_RATE" | "HOST_CACHE" | "FAILED_RETRY_BACKOFF" | null;
  cacheDurationMs?: number | null;
  addConnectionUrl: string;
  lastCheckedFormatted?: string;
  onRefresh?: () => void;
  onLoadMore?: () => void;
}

export const DeliveryPreviewPresentational = ({
  isLoading = false,
  error = null,
  isFetching = false,
  results = [],
  total = 0,
  hasMore = false,
  hasNoConnections = false,
  feedState = null,
  refreshRateSeconds,
  nextRetryAtIso,
  nextRetryReason,
  cacheDurationMs,
  addConnectionUrl,
  lastCheckedFormatted = "Never",
  onRefresh = () => {},
  onLoadMore = () => {},
}: DeliveryPreviewPresentationalProps) => {
  const hasFeedLevelState = !!feedState;
  const hasNoData = results.length === 0 && !isLoading && !hasFeedLevelState;
  const patternAlert = getPatternAlert(results, refreshRateSeconds, nextRetryAtIso);

  return (
    <Stack gap={4} mb={8} border="solid 1px" borderColor="border" borderRadius="l3">
      <Box>
        <Flex
          px={4}
          py={4}
          justifyContent="space-between"
          alignItems={{ base: "stretch", md: "flex-start" }}
          flexDirection={{ base: "column", md: "row" }}
          gap={3}
        >
          <Stack gap={1}>
            <Heading as="h3" size="sm" m={0} id="delivery-preview-title">
              Delivery Preview
            </Heading>
            <Text color="fg.muted" fontSize="sm">
              Preview how articles will be handled when your feed is next processed.
            </Text>
            <Text fontSize="xs" color="fg.muted" display={{ base: "block", md: "none" }}>
              Preview generated: {lastCheckedFormatted}
            </Text>
          </Stack>
          <HStack gap={2} flexShrink={0}>
            <Text
              fontSize="xs"
              color="fg.muted"
              whiteSpace="nowrap"
              display={{ base: "none", md: "block" }}
            >
              Preview generated: {lastCheckedFormatted}
            </Text>
            <SafeLoadingButton
              size={{ base: "md", md: "sm" }}
              onClick={onRefresh}
              loading={isFetching}
              variant="outline"
            >
              <FaArrowsRotate /> Refresh
            </SafeLoadingButton>
          </HStack>
        </Flex>
        <Box px={4}>
          <Separator />
        </Box>
      </Box>
      <Box px={4} pb={4}>
        {isLoading && <DeliveryPreviewAccordionSkeleton />}
        {error && (
          <InlineErrorAlert title="Failed to load delivery preview" description={error.message} />
        )}
        {!isLoading && !error && hasNoConnections && (
          <Alert.Root status="info">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                <Stack gap={2}>
                  <Text>
                    Add a connection to specify where articles should be delivered. Delivery
                    previews will be available once you have at least one active connection.
                  </Text>
                  <PrimaryActionButton asChild size="sm" width="fit-content">
                    <Link to={addConnectionUrl}>Add Connection</Link>
                  </PrimaryActionButton>
                </Stack>
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        {!isLoading && !error && !hasNoConnections && hasNoData && (
          <Box py={4}>
            <Text color="fg.muted">
              No articles found in the feed. Articles will appear here once the feed has content to
              analyze.
            </Text>
          </Box>
        )}
        {!isLoading && !error && !hasNoConnections && hasFeedLevelState && feedState && (
          <FeedLevelStateDisplay feedState={feedState} />
        )}
        {!isLoading && !error && !hasNoConnections && !hasNoData && !hasFeedLevelState && (
          <Stack gap={4}>
            {patternAlert && (
              <Alert.Root status={patternAlert.type}>
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{patternAlert.message}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}
            {isFetching && results.length === 0 ? (
              <DeliveryPreviewAccordionSkeleton />
            ) : (
              <DeliveryPreviewAccordion
                results={results}
                nextRetryAtIso={nextRetryAtIso}
                nextRetryReason={nextRetryReason}
                cacheDurationMs={cacheDurationMs}
              />
            )}
            <Flex justifyContent="space-between" alignItems="center">
              <Text fontSize="sm" color="fg.muted">
                Showing {results.length} of {total} articles
              </Text>
              {hasMore && (
                <SafeLoadingButton
                  size={{ base: "md", md: "sm" }}
                  onClick={onLoadMore}
                  loading={isFetching}
                  variant="outline"
                >
                  Load More
                </SafeLoadingButton>
              )}
            </Flex>
          </Stack>
        )}
      </Box>
    </Stack>
  );
};

export const DeliveryPreview = () => {
  const { userFeed } = useUserFeedContext();
  const { workspaceSlug } = useFeedScope();
  const {
    results,
    status,
    error,
    fetchStatus,
    loadMore,
    refresh,
    hasMore,
    total,
    lastChecked,
    feedState,
  } = useDeliveryPreviewWithPagination({
    feedId: userFeed.id,
  });

  const { data: requestsData } = useUserFeedRequests({
    feedId: userFeed.id,
    data: { skip: 0, limit: 1 },
  });

  const nextRetryAtIso = requestsData?.result.nextRetryAtIso;
  const nextRetryReason = requestsData?.result.nextRetryReason;
  const latestFreshnessLifetimeMs = requestsData?.result.requests?.[0]?.freshnessLifetimeMs;

  const activeConnections = userFeed.connections.filter((c) => !c.disabledCode);
  const hasNoConnections = activeConnections.length === 0;
  const isLoading = status === "loading";
  const isFetching = fetchStatus === "fetching";

  const formatLastChecked = () => {
    if (!lastChecked) return "Never";

    return dayjs(lastChecked).fromNow();
  };

  return (
    <DeliveryPreviewPresentational
      isLoading={isLoading}
      error={error}
      isFetching={isFetching}
      results={results}
      total={total}
      hasMore={hasMore}
      hasNoConnections={hasNoConnections}
      feedState={feedState}
      refreshRateSeconds={getEffectiveRefreshRateSeconds(userFeed)}
      nextRetryAtIso={nextRetryAtIso}
      nextRetryReason={nextRetryReason}
      cacheDurationMs={latestFreshnessLifetimeMs}
      addConnectionUrl={pages.userFeed(userFeed.id, {
        tab: UserFeedTabSearchParam.Connections,
        scope: workspaceSlug ? { workspaceSlug } : undefined,
      })}
      lastCheckedFormatted={formatLastChecked()}
      onRefresh={refresh}
      onLoadMore={loadMore}
    />
  );
};
