import {
  Badge,
  Box,
  Button,
  Grid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import dayjs from "dayjs";
import {
  ArticleDeliveryOutcome,
  ArticleDeliveryResult,
  MediumDeliveryResult,
} from "../../../types/DeliveryPreview";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";
import { pages } from "../../../../../constants";
import { FeedConnectionType } from "../../../../../types";
import { DeliveryChecksModal } from "./DeliveryChecksModal";
import { getOutcomeColorScheme } from "./deliveryPreviewUtils";
import {
  formatRefreshRateSeconds,
  getEffectiveRefreshRateSeconds,
  getNextCheckText,
} from "../../../../../utils/formatRefreshRateSeconds";

interface Props {
  result: ArticleDeliveryResult;
  lastRequestAtUnix?: number;
}

const getOutcomeLabel = (outcome: ArticleDeliveryOutcome): string => {
  switch (outcome) {
    case ArticleDeliveryOutcome.WouldDeliver:
      return "Would deliver";
    case ArticleDeliveryOutcome.FirstRunBaseline:
      return "Skipped (learning)";
    case ArticleDeliveryOutcome.DuplicateId:
      return "Previously seen";
    case ArticleDeliveryOutcome.BlockedByComparison:
      return "Unchanged";
    case ArticleDeliveryOutcome.FilteredByDateCheck:
      return "Too old";
    case ArticleDeliveryOutcome.FilteredByMediumFilter:
      return "Blocked by filters";
    case ArticleDeliveryOutcome.RateLimitedFeed:
      return "Daily limit reached";
    case ArticleDeliveryOutcome.RateLimitedMedium:
      return "Limit reached";
    case ArticleDeliveryOutcome.WouldDeliverPassingComparison:
      return "Will re-deliver";
    case ArticleDeliveryOutcome.FeedUnchanged:
      return "No changes detected";
    case ArticleDeliveryOutcome.FeedError:
      return "Feed error";
    default:
      return "Unknown";
  }
};

const getExplanationText = (
  outcome: ArticleDeliveryOutcome,
  refreshRateSeconds: number,
  lastRequestAtUnix?: number,
): string => {
  const refreshRateText = `Your feed checks for new content every ${formatRefreshRateSeconds(refreshRateSeconds)}.`;
  const nextCheckText = getNextCheckText(lastRequestAtUnix, refreshRateSeconds);
  const timingText = nextCheckText ? `${refreshRateText} ${nextCheckText}` : refreshRateText;

  switch (outcome) {
    case ArticleDeliveryOutcome.WouldDeliver:
      return `This article would be delivered to Discord when the feed is next processed. ${timingText}`;
    case ArticleDeliveryOutcome.FirstRunBaseline:
      return "This feed is in its learning phase. MonitoRSS skips pre-existing articles to avoid flooding your channel with old content.";
    case ArticleDeliveryOutcome.DuplicateId:
      return "MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added. Either way, it won't be sent again to avoid duplicates.";
    case ArticleDeliveryOutcome.BlockedByComparison:
      return "The fields in your Blocking Comparisons haven't changed since this article was last checked.";
    case ArticleDeliveryOutcome.FilteredByDateCheck:
      return "This article's publish date is older than your maximum article age setting. Adjust date settings if you want older articles delivered.";
    case ArticleDeliveryOutcome.FilteredByMediumFilter:
      return "This article doesn't match the filter rules for your connection, so it will not be delivered. Review your filter settings to adjust what gets delivered.";
    case ArticleDeliveryOutcome.RateLimitedFeed:
      return "Your feed has hit its daily article limit. Upgrade your plan or wait until tomorrow for more articles.";
    case ArticleDeliveryOutcome.RateLimitedMedium:
      return "This connection has reached its delivery limit. The article will be delivered automatically once the limit resets.";
    case ArticleDeliveryOutcome.WouldDeliverPassingComparison:
      return `This article was seen before, but one of your Passing Comparison fields changed, so it will be re-delivered as an update. ${timingText}`;
    case ArticleDeliveryOutcome.FeedUnchanged:
      return "The feed's content hasn't changed since it was last checked. MonitoRSS skips unchanged feeds to save resources. New articles will be detected automatically once the publisher has indicated that there are new changes.";
    case ArticleDeliveryOutcome.FeedError:
      return "MonitoRSS couldn't fetch or parse this feed. This may be temporary (server issues) or indicate a problem with the feed URL.";
    default:
      return "";
  }
};

interface ConnectionResultRowProps {
  mediumResult: MediumDeliveryResult;
}

const ConnectionResultRow = ({ mediumResult }: ConnectionResultRowProps) => {
  const { userFeed } = useUserFeedContext();

  const connection = userFeed.connections.find((c) => c.id === mediumResult.mediumId);
  const connectionName = connection?.name || mediumResult.mediumId;

  return (
    <Tr>
      <Td>
        <Badge colorScheme={getOutcomeColorScheme(mediumResult.outcome)} fontSize="xs">
          {getOutcomeLabel(mediumResult.outcome)}
        </Badge>
      </Td>
      <Td>
        {connection ? (
          <Button
            as={Link}
            to={pages.userFeedConnection({
              feedId: userFeed.id,
              connectionType: connection.key as FeedConnectionType,
              connectionId: mediumResult.mediumId,
            })}
            target="_blank"
            variant="link"
            color="blue.300"
            fontWeight="semibold"
            size="sm"
            rightIcon={<ExternalLinkIcon />}
          >
            {connectionName}
          </Button>
        ) : (
          <Text color="whiteAlpha.700" fontStyle="italic">
            (deleted connection)
          </Text>
        )}
      </Td>
    </Tr>
  );
};

export const ArticleDeliveryDetails = ({ result, lastRequestAtUnix }: Props) => {
  const { userFeed } = useUserFeedContext();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const isLearningPhase = result.outcome === ArticleDeliveryOutcome.FirstRunBaseline;
  const connectionCount = result.mediumResults.length;

  const hasPartialDelivery = () => {
    const outcomes = result.mediumResults.map((m) => m.outcome);
    const uniqueOutcomes = new Set(outcomes);

    return uniqueOutcomes.size > 1;
  };

  const effectiveRefreshRateSeconds = getEffectiveRefreshRateSeconds(userFeed);

  const getDisplayText = () => {
    if (isLearningPhase) {
      const plural = connectionCount !== 1 ? "s" : "";
      const formattedTime = formatRefreshRateSeconds(effectiveRefreshRateSeconds);
      const nextCheckText = getNextCheckText(lastRequestAtUnix, effectiveRefreshRateSeconds);
      const nextCheckSuffix = nextCheckText ? ` ${nextCheckText}` : "";

      return `Skipped (Learning Phase): This article existed before the feed was added. MonitoRSS skips pre-existing articles to avoid flooding your channel with old content. New articles will be delivered to all ${connectionCount} connection${plural} once learning completes (within ${formattedTime}).${nextCheckSuffix}`;
    }

    if (hasPartialDelivery()) {
      return "This article would deliver to some connections but not others.";
    }

    return getExplanationText(result.outcome, effectiveRefreshRateSeconds, lastRequestAtUnix);
  };

  return (
    <Box bg="gray.800" px={6} py={4} mx={4} mb={4} borderRadius="md">
      <Stack spacing={4}>
        <Box>
          <Text fontWeight="semibold" mb={1}>
            Details
          </Text>
          <Text color="whiteAlpha.800" fontSize="sm">
            {getDisplayText()}
          </Text>
        </Box>
        <Box>
          <Text fontWeight="semibold" mb={2}>
            Dates
          </Text>
          <Grid as="dl" templateColumns="140px 1fr" gap={1} fontSize="sm" m={0}>
            <Text as="dt" color="gray.400">
              Published
            </Text>
            <Box as="dd" ml={0}>
              {result.articlePublishedDate ? (
                <Tooltip
                  label={dayjs(result.articlePublishedDate).format("DD MMM YYYY, HH:mm:ss")}
                  hasArrow
                >
                  <Text
                    as="time"
                    dateTime={result.articlePublishedDate}
                    tabIndex={0}
                    cursor="default"
                    color="gray.300"
                    display="inline"
                    borderBottom="1px dashed"
                    borderColor="whiteAlpha.300"
                    sx={{ cursor: "help" }}
                  >
                    {dayjs(result.articlePublishedDate).fromNow()}
                  </Text>
                </Tooltip>
              ) : (
                <Tooltip
                  label="This feed does not include a published date for this article"
                  hasArrow
                >
                  <Text
                    tabIndex={0}
                    color="gray.400"
                    display="inline"
                    borderBottom="1px dashed"
                    borderColor="whiteAlpha.200"
                    sx={{ cursor: "help" }}
                    aria-label="Not available. This feed does not include a published date for this article."
                  >
                    --
                  </Text>
                </Tooltip>
              )}
            </Box>
            <Text as="dt" color="gray.400">
              First detected
            </Text>
            <Box as="dd" ml={0}>
              {result.articleStoredDate ? (
                <Tooltip
                  label={dayjs(result.articleStoredDate).format("DD MMM YYYY, HH:mm:ss")}
                  hasArrow
                >
                  <Text
                    as="time"
                    dateTime={result.articleStoredDate}
                    tabIndex={0}
                    cursor="default"
                    color="gray.300"
                    display="inline"
                    borderBottom="1px dashed"
                    borderColor="whiteAlpha.300"
                    sx={{ cursor: "help" }}
                  >
                    {dayjs(result.articleStoredDate).fromNow()}
                  </Text>
                </Tooltip>
              ) : (
                <Tooltip label="This article has not been stored yet" hasArrow>
                  <Text
                    tabIndex={0}
                    color="gray.400"
                    display="inline"
                    borderBottom="1px dashed"
                    borderColor="whiteAlpha.200"
                    sx={{ cursor: "help" }}
                    aria-label="Not available. This article has not been stored yet."
                  >
                    --
                  </Text>
                </Tooltip>
              )}
            </Box>
          </Grid>
        </Box>
        {!isLearningPhase && result.mediumResults.length > 0 && (
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Connections
            </Text>
            <TableContainer>
              <Table size="sm" variant="simple" sx={{ tableLayout: "fixed" }}>
                <Thead>
                  <Tr>
                    <Th width="300px">Status</Th>
                    <Th>Name</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {result.mediumResults.map((mediumResult) => (
                    <ConnectionResultRow key={mediumResult.mediumId} mediumResult={mediumResult} />
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
        )}
        <Box>
          <Button variant="outline" size="sm" onClick={onOpen}>
            View Delivery Checks
          </Button>
        </Box>
      </Stack>
      <DeliveryChecksModal isOpen={isOpen} onClose={onClose} result={result} />
    </Box>
  );
};
