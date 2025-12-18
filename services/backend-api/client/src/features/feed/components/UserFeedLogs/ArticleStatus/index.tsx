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
  Skeleton,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
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
import { ArticleStatusRow } from "./ArticleStatusRow";
import { ArticleStatusCard } from "./ArticleStatusCard";
import {
  ArticleDiagnosisOutcome,
  ArticleDiagnosticResult,
} from "../../../types/ArticleDiagnostics";
import { formatRefreshRateSeconds } from "../../../../../utils/formatRefreshRateSeconds";
import { FeedLevelStateDisplay } from "./FeedLevelStateDisplay";

dayjs.extend(relativeTime);

const getPatternAlert = (
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
  const hasFeedLevelState = !!feedState;
  const hasNoData = results.length === 0 && status === "success" && !hasFeedLevelState;
  const isLoading = status === "loading";
  const isFetching = fetchStatus === "fetching";

  const patternAlert = getPatternAlert(results, userFeed.refreshRateSeconds);

  const formatLastChecked = () => {
    if (!lastChecked) return "Never";

    return dayjs(lastChecked).fromNow();
  };

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
                Preview generated: {formatLastChecked()}
              </Text>
            </Show>
          </Stack>
          <HStack spacing={2} flexShrink={0}>
            <Hide below="md">
              <Text fontSize="xs" color="whiteAlpha.600" whiteSpace="nowrap">
                Preview generated: {formatLastChecked()}
              </Text>
            </Hide>
            <Button
              size={{ base: "md", md: "sm" }}
              leftIcon={<RepeatIcon />}
              onClick={refresh}
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
        {isLoading && (
          <>
            {/* Desktop: Table skeleton */}
            <Show above="md">
              <TableContainer border="1px solid" borderColor="gray.700" borderRadius="md">
                <Table size="sm" variant="simple" aria-labelledby="article-status-table-title">
                  <Thead>
                    <Tr>
                      <Th width="150px">Status</Th>
                      <Th>Article Title</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {[...Array(5)].map((_, i) => (
                      <Tr key={i}>
                        <Td>
                          <Skeleton height="20px" width="100px" />
                        </Td>
                        <Td>
                          <Skeleton height="20px" />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </Show>
            {/* Mobile: Card skeleton */}
            <Hide above="md">
              <Stack spacing={3}>
                {[...Array(5)].map((_, i) => (
                  <Box key={i} border="1px solid" borderColor="gray.700" borderRadius="md" p={4}>
                    <Stack spacing={2}>
                      <Skeleton height="20px" />
                      <Skeleton height="16px" width="120px" />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Hide>
          </>
        )}
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
                  Add a connection to specify where articles should be delivered. Article
                  diagnostics will be available once you have at least one active connection.
                </Text>
                <Button
                  as={Link}
                  to={pages.userFeed(userFeed.id, { tab: UserFeedTabSearchParam.Connections })}
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
          <FeedLevelStateDisplay feedState={feedState} feedId={userFeed.id} />
        )}
        {!isLoading && !error && !hasNoConnections && !hasNoData && !hasFeedLevelState && (
          <Stack spacing={4}>
            {patternAlert && (
              <Alert status={patternAlert.type} borderRadius="md">
                <AlertIcon />
                <AlertDescription>{patternAlert.message}</AlertDescription>
              </Alert>
            )}
            {/* Desktop: Table layout */}
            <Show above="md">
              <Box border="1px solid" borderColor="gray.700" borderRadius="md" overflowX="hidden">
                <Table
                  size="sm"
                  variant="simple"
                  aria-labelledby="article-status-table-title"
                  tableLayout="fixed"
                  width="100%"
                >
                  <Thead>
                    <Tr>
                      <Th width="150px">Status</Th>
                      <Th>Article Title</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {isFetching && results.length === 0
                      ? [...Array(5)].map((_, i) => (
                          <Tr key={i}>
                            <Td>
                              <Skeleton height="20px" width="100px" />
                            </Td>
                            <Td>
                              <Skeleton height="20px" />
                            </Td>
                          </Tr>
                        ))
                      : results.map((result) => (
                          <ArticleStatusRow key={result.articleId} result={result} />
                        ))}
                  </Tbody>
                </Table>
              </Box>
            </Show>
            {/* Mobile: Card layout */}
            <Hide above="md">
              <Stack spacing={3}>
                {isFetching && results.length === 0
                  ? [...Array(5)].map((_, i) => (
                      <Box
                        key={i}
                        border="1px solid"
                        borderColor="gray.700"
                        borderRadius="md"
                        p={4}
                      >
                        <Stack spacing={2}>
                          <Skeleton height="20px" />
                          <Skeleton height="16px" width="120px" />
                        </Stack>
                      </Box>
                    ))
                  : results.map((result) => (
                      <ArticleStatusCard key={result.articleId} result={result} />
                    ))}
              </Stack>
            </Hide>
            <Flex justifyContent="space-between" alignItems="center">
              <Text fontSize="sm" color="whiteAlpha.600">
                Showing {results.length} of {total} articles
              </Text>
              {hasMore && (
                <Button
                  size={{ base: "md", md: "sm" }}
                  onClick={loadMore}
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
