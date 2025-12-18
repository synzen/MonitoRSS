import {
  Badge,
  Box,
  Button,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import {
  ArticleDiagnosisOutcome,
  ArticleDiagnosticResult,
  MediumDiagnosticResult,
} from "../../../types/ArticleDiagnostics";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";
import { pages } from "../../../../../constants";
import { FeedConnectionType } from "../../../../../types";
import { DeliveryChecksModal } from "./DeliveryChecksModal";
import { getOutcomeColorScheme } from "./statusUtils";
import { formatRefreshRateSeconds } from "../../../../../utils/formatRefreshRateSeconds";

interface Props {
  result: ArticleDiagnosticResult;
}

const getOutcomeLabel = (outcome: ArticleDiagnosisOutcome): string => {
  switch (outcome) {
    case ArticleDiagnosisOutcome.WouldDeliver:
      return "Would deliver";
    case ArticleDiagnosisOutcome.FirstRunBaseline:
      return "Skipped (learning)";
    case ArticleDiagnosisOutcome.DuplicateId:
      return "Previously seen";
    case ArticleDiagnosisOutcome.BlockedByComparison:
      return "Unchanged";
    case ArticleDiagnosisOutcome.FilteredByDateCheck:
      return "Too old";
    case ArticleDiagnosisOutcome.FilteredByMediumFilter:
      return "Blocked by filters";
    case ArticleDiagnosisOutcome.RateLimitedFeed:
      return "Daily limit reached";
    case ArticleDiagnosisOutcome.RateLimitedMedium:
      return "Limit reached";
    case ArticleDiagnosisOutcome.WouldDeliverPassingComparison:
      return "Will re-deliver";
    case ArticleDiagnosisOutcome.FeedUnchanged:
      return "No changes detected";
    case ArticleDiagnosisOutcome.FeedError:
      return "Feed error";
    default:
      return "Unknown";
  }
};

const getExplanationText = (outcome: ArticleDiagnosisOutcome): string => {
  switch (outcome) {
    case ArticleDiagnosisOutcome.WouldDeliver:
      return "This article would be delivered to Discord when the feed is next processed.";
    case ArticleDiagnosisOutcome.FirstRunBaseline:
      return "This feed is in its learning phase. MonitoRSS skips pre-existing articles to avoid flooding your channel with old content.";
    case ArticleDiagnosisOutcome.DuplicateId:
      return "MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added. Either way, it won't be sent again to avoid duplicates.";
    case ArticleDiagnosisOutcome.BlockedByComparison:
      return "The fields in your Blocking Comparisons haven't changed since this article was last checked.";
    case ArticleDiagnosisOutcome.FilteredByDateCheck:
      return "This article's publish date is older than your maximum article age setting. Adjust date settings if you want older articles delivered.";
    case ArticleDiagnosisOutcome.FilteredByMediumFilter:
      return "This article doesn't match the filter rules for your connection. Review your filter settings to adjust what gets delivered.";
    case ArticleDiagnosisOutcome.RateLimitedFeed:
      return "Your feed has hit its daily article limit. Upgrade your plan or wait until tomorrow for more articles.";
    case ArticleDiagnosisOutcome.RateLimitedMedium:
      return "This connection has reached its delivery limit. The article will be delivered automatically once the limit resets.";
    case ArticleDiagnosisOutcome.WouldDeliverPassingComparison:
      return "This article was seen before, but one of your Passing Comparison fields changed, so it will be re-delivered as an update.";
    case ArticleDiagnosisOutcome.FeedUnchanged:
      return "The feed's content hasn't changed since it was last checked. MonitoRSS skips unchanged feeds to save resources. New articles will be detected automatically once the publisher has indicated that there are new changes.";
    case ArticleDiagnosisOutcome.FeedError:
      return "MonitoRSS couldn't fetch or parse this feed. This may be temporary (server issues) or indicate a problem with the feed URL.";
    default:
      return "";
  }
};

interface ConnectionResultRowProps {
  mediumResult: MediumDiagnosticResult;
}

const ConnectionResultRow = ({ mediumResult }: ConnectionResultRowProps) => {
  const { userFeed } = useUserFeedContext();

  const connection = userFeed.connections.find((c) => c.id === mediumResult.mediumId);
  const connectionName = connection?.name || mediumResult.mediumId;

  return (
    <Tr>
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
      <Td>
        <Badge colorScheme={getOutcomeColorScheme(mediumResult.outcome)} fontSize="xs">
          {getOutcomeLabel(mediumResult.outcome)}
        </Badge>
      </Td>
    </Tr>
  );
};

export const ArticleDiagnosticDetails = ({ result }: Props) => {
  const { userFeed } = useUserFeedContext();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const isLearningPhase = result.outcome === ArticleDiagnosisOutcome.FirstRunBaseline;
  const connectionCount = result.mediumResults.length;

  const hasPartialDelivery = () => {
    const outcomes = result.mediumResults.map((m) => m.outcome);
    const uniqueOutcomes = new Set(outcomes);

    return uniqueOutcomes.size > 1;
  };

  const getDisplayText = () => {
    if (isLearningPhase) {
      const plural = connectionCount !== 1 ? "s" : "";
      const formattedTime = formatRefreshRateSeconds(userFeed.refreshRateSeconds);

      return `Skipped (Learning Phase): This article existed before the feed was added. MonitoRSS skips pre-existing articles to avoid flooding your channel with old content. New articles will be delivered to all ${connectionCount} connection${plural} once learning completes (within ${formattedTime}).`;
    }

    if (hasPartialDelivery()) {
      return "This article would deliver to some connections but not others.";
    }

    return getExplanationText(result.outcome);
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
        {!isLearningPhase && result.mediumResults.length > 0 && (
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Connections
            </Text>
            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Status</Th>
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
