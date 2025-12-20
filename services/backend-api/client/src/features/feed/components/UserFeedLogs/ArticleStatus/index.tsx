import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  Hide,
  HStack,
  Show,
  Stack,
  Text,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";
import { pages } from "../../../../../constants";
import { UserFeedTabSearchParam } from "../../../../../constants/userFeedTabSearchParam";
import { useArticleDiagnosticsWithPagination } from "../../../hooks/useArticleDiagnosticsWithPagination";
import { InlineErrorAlert } from "../../../../../components";
import { ArticleStatusAccordion, ArticleStatusAccordionSkeleton } from "./ArticleStatusAccordion";
import {
  ArticleDiagnosisOutcome,
  ArticleDiagnosticResult,
} from "../../../types/ArticleDiagnostics";
import { formatRefreshRateSeconds } from "../../../../../utils/formatRefreshRateSeconds";
import { FeedLevelStateDisplay, FeedState } from "./FeedLevelStateDisplay";

dayjs.extend(relativeTime);

export const getPatternAlert = (
  results: ArticleDiagnosticResult[],
  refreshRateSeconds: number
): { type: "info" | "warning"; message: string } | null => {
  if (results.length === 0) return null;

  const outcomeCounts = results.reduce((acc, r) => {
    const outcome = r.outcome as ArticleDiagnosisOutcome;
    acc[outcome] = (acc[outcome] || 0) + 1;

    return acc;
  }, {} as Record<string, number>);

  const totalResults = results.length;
  const dominantOutcome = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1])[0];

  if (!dominantOutcome) return null;

  const [outcome, count] = dominantOutcome;
  const percentage = count / totalResults;

  // First run is a feed-level state - if any article has it, all do
  if (outcome === ArticleDiagnosisOutcome.FirstRunBaseline && count >= 1) {
    const formattedTime = formatRefreshRateSeconds(refreshRateSeconds);

    return {
      type: "info",
      message: `This feed is in its learning phase. MonitoRSS is identifying existing articles so it only delivers new ones. This typically completes within ${formattedTime}.`,
    };
  }

  if (outcome === ArticleDiagnosisOutcome.RateLimitedFeed && percentage > 0.5) {
    return {
      type: "warning",
      message:
        "Your feed has delivered the maximum articles allowed in a 24-hour period. Delivery resumes automatically as older deliveries fall outside this window—no action needed.",
    };
  }

  if (outcome === ArticleDiagnosisOutcome.DuplicateId && percentage === 1) {
    return {
      type: "info",
      message:
        "All articles in this feed have already been processed. MonitoRSS only delivers articles the first time they appear. New articles will be sent automatically when they're published to your feed.",
    };
  }

  // FeedUnchanged is a feed-level state - if any article has it, all do
  if (outcome === ArticleDiagnosisOutcome.FeedUnchanged && count >= 1) {
    return {
      type: "info",
      message:
        "The feed's content hasn't changed since it was last checked. MonitoRSS skips unchanged feeds to save resources. Articles will be delivered automatically when new content is detected.",
    };
  }

  return null;
};

export interface ArticleStatusPresentationalProps {
  isLoading?: boolean;
  error?: Error | null;
  isFetching?: boolean;
  results?: ArticleDiagnosticResult[];
  total?: number;
  hasMore?: boolean;
  hasNoConnections?: boolean;
  feedState?: FeedState | null;
  feedId: string;
  refreshRateSeconds: number;
  addConnectionUrl: string;
  lastCheckedFormatted?: string;
  onRefresh?: () => void;
  onLoadMore?: () => void;
}

export const ArticleStatusPresentational = ({
  isLoading = false,
  error = null,
  isFetching = false,
  results = [],
  total = 0,
  hasMore = false,
  hasNoConnections = false,
  feedState = null,
  feedId,
  refreshRateSeconds,
  addConnectionUrl,
  lastCheckedFormatted = "Never",
  onRefresh = () => {},
  onLoadMore = () => {},
}: ArticleStatusPresentationalProps) => {
  const hasFeedLevelState = !!feedState;
  const hasNoData = results.length === 0 && !isLoading && !hasFeedLevelState;
  const patternAlert = getPatternAlert(results, refreshRateSeconds);

  return (
    <Stack spacing={4} mb={8} border="solid 1px" borderColor="gray.700" borderRadius="md">
      <Box>
        <Flex
          px={4}
          py={4}
          justifyContent="space-between"
          alignItems={{ base: "stretch", md: "flex-start" }}
          flexDirection={{ base: "column", md: "row" }}
          gap={3}
        >
          <Stack spacing={1}>
            <Heading as="h3" size="sm" m={0} id="article-status-table-title">
              Delivery Preview
            </Heading>
            <Text color="whiteAlpha.700" fontSize="sm">
              Preview how articles will be handled when your feed is next processed.
            </Text>
            <Show below="md">
              <Text fontSize="xs" color="whiteAlpha.600">
                Preview generated: {lastCheckedFormatted}
              </Text>
            </Show>
          </Stack>
          <HStack spacing={2} flexShrink={0}>
            <Hide below="md">
              <Text fontSize="xs" color="whiteAlpha.600" whiteSpace="nowrap">
                Preview generated: {lastCheckedFormatted}
              </Text>
            </Hide>
            <Button
              size={{ base: "md", md: "sm" }}
              leftIcon={<RepeatIcon />}
              onClick={onRefresh}
              isLoading={isFetching}
              variant="outline"
            >
              Refresh
            </Button>
          </HStack>
        </Flex>
        <Box px={4}>
          <Divider />
        </Box>
      </Box>
      <Box px={4} pb={4}>
        {isLoading && <ArticleStatusAccordionSkeleton />}
        {error && (
          <InlineErrorAlert
            title="Failed to load article diagnostics"
            description={error.message}
          />
        )}
        {!isLoading && !error && hasNoConnections && (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <AlertDescription>
              <Stack spacing={2}>
                <Text>
                  Add a connection to specify where articles should be delivered. Delivery previews
                  will be available once you have at least one active connection.
                </Text>
                <Button
                  as={Link}
                  to={addConnectionUrl}
                  colorScheme="blue"
                  size="sm"
                  width="fit-content"
                >
                  Add Connection
                </Button>
              </Stack>
            </AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && !hasNoConnections && hasNoData && (
          <Box py={4}>
            <Text color="whiteAlpha.700">
              No articles found in the feed. Articles will appear here once the feed has content to
              analyze.
            </Text>
          </Box>
        )}
        {!isLoading && !error && !hasNoConnections && hasFeedLevelState && feedState && (
          <FeedLevelStateDisplay feedState={feedState} feedId={feedId} />
        )}
        {!isLoading && !error && !hasNoConnections && !hasNoData && !hasFeedLevelState && (
          <Stack spacing={4}>
            {patternAlert && (
              <Alert status={patternAlert.type} borderRadius="md">
                <AlertIcon />
                <AlertDescription>{patternAlert.message}</AlertDescription>
              </Alert>
            )}
            {isFetching && results.length === 0 ? (
              <ArticleStatusAccordionSkeleton />
            ) : (
              <ArticleStatusAccordion results={results} />
            )}
            <Flex justifyContent="space-between" alignItems="center">
              <Text fontSize="sm" color="whiteAlpha.600">
                Showing {results.length} of {total} articles
              </Text>
              {hasMore && (
                <Button
                  size={{ base: "md", md: "sm" }}
                  onClick={onLoadMore}
                  isLoading={isFetching}
                  variant="outline"
                >
                  Load More
                </Button>
              )}
            </Flex>
          </Stack>
        )}
      </Box>
    </Stack>
  );
};

export const ArticleStatus = () => {
  const { userFeed } = useUserFeedContext();
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
  } = useArticleDiagnosticsWithPagination({
    feedId: userFeed.id,
  });

  const activeConnections = userFeed.connections.filter((c) => !c.disabledCode);
  const hasNoConnections = activeConnections.length === 0;
  const isLoading = status === "loading";
  const isFetching = fetchStatus === "fetching";

  const formatLastChecked = () => {
    if (!lastChecked) return "Never";

    return dayjs(lastChecked).fromNow();
  };

  return (
    <ArticleStatusPresentational
      isLoading={isLoading}
      error={error}
      isFetching={isFetching}
      results={results}
      total={total}
      hasMore={hasMore}
      hasNoConnections={hasNoConnections}
      feedState={feedState}
      feedId={userFeed.id}
      refreshRateSeconds={userFeed.refreshRateSeconds}
      addConnectionUrl={pages.userFeed(userFeed.id, { tab: UserFeedTabSearchParam.Connections })}
      lastCheckedFormatted={formatLastChecked()}
      onRefresh={refresh}
      onLoadMore={loadMore}
    />
  );
};
