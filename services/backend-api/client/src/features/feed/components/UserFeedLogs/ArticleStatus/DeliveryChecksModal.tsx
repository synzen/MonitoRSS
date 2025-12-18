import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  CheckIcon,
  MinusIcon,
  CloseIcon,
  ChevronRightIcon,
  InfoIcon,
  RepeatIcon,
  WarningIcon,
} from "@chakra-ui/icons";
import { formatRefreshRateSeconds } from "../../../../../utils/formatRefreshRateSeconds";
import {
  ArticleDiagnosisOutcome,
  ArticleDiagnosticResult,
  DiagnosticStage,
  DiagnosticStageResult,
  DiagnosticStageStatus,
} from "../../../types/ArticleDiagnostics";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: ArticleDiagnosticResult;
  initialMediumId?: string;
}

const getStageName = (stage: DiagnosticStage): string => {
  switch (stage) {
    case DiagnosticStage.FeedState:
      return "Feed State";
    case DiagnosticStage.IdComparison:
      return "Duplicate Check";
    case DiagnosticStage.BlockingComparison:
      return "Blocking Comparison";
    case DiagnosticStage.PassingComparison:
      return "Passing Comparison";
    case DiagnosticStage.DateCheck:
      return "Date Check";
    case DiagnosticStage.MediumFilter:
      return "Connection Filters";
    case DiagnosticStage.FeedRateLimit:
      return "Feed Rate Limit";
    case DiagnosticStage.MediumRateLimit:
      return "Connection Rate Limit";
    default:
      return stage;
  }
};

interface StageRowProps {
  stageResult: DiagnosticStageResult;
  isAutoExpanded: boolean;
}

const StageRow = ({ stageResult, isAutoExpanded }: StageRowProps) => {
  const [isExpanded, setIsExpanded] = useState(isAutoExpanded);
  const isSkipped = stageResult.status === DiagnosticStageStatus.Skipped;
  const isPassed = stageResult.status === DiagnosticStageStatus.Passed;
  const isFailed = stageResult.status === DiagnosticStageStatus.Failed;

  useEffect(() => {
    setIsExpanded(isAutoExpanded);
  }, [isAutoExpanded]);

  const getStatusIcon = () => {
    if (isPassed) {
      return <CheckIcon color="green.400" boxSize={3} />;
    }

    if (isFailed) {
      return <CloseIcon color="white" boxSize={3} />;
    }

    return <MinusIcon color="gray.500" boxSize={3} />;
  };

  const getRowStyles = () => {
    if (isFailed) {
      return {
        bg: "red.900",
        borderLeft: "3px solid",
        borderLeftColor: "red.400",
      };
    }

    if (isPassed) {
      return {
        borderLeft: "3px solid",
        borderLeftColor: "green.200",
      };
    }

    return {};
  };

  const canExpand = !isSkipped && stageResult.details;

  return (
    <Box {...getRowStyles()}>
      <Flex
        px={4}
        py={3}
        cursor={canExpand ? "pointer" : "default"}
        onClick={canExpand ? () => setIsExpanded(!isExpanded) : undefined}
        _hover={canExpand ? { bg: "whiteAlpha.50" } : undefined}
        alignItems="center"
        opacity={isSkipped ? 0.5 : 1}
      >
        <HStack spacing={3} flex={1}>
          {canExpand ? (
            <Box
              color="gray.500"
              flexShrink={0}
              transform={isExpanded ? "rotate(90deg)" : "rotate(0deg)"}
              transition="transform 150ms ease-out"
            >
              <ChevronRightIcon boxSize={4} />
            </Box>
          ) : (
            <Box width={4} />
          )}
          <Box flexShrink={0}>{getStatusIcon()}</Box>
          <Text fontWeight="semibold" fontSize="sm" minWidth="150px">
            {getStageName(stageResult.stage)}
          </Text>
          <Text fontSize="sm" color="whiteAlpha.800" flex={1}>
            {stageResult.summary}
          </Text>
        </HStack>
      </Flex>
      {canExpand && (
        <Collapse in={isExpanded} animateOpacity>
          <Box ml={10} pl={4} py={2} fontSize="sm">
            <StageDetails stageResult={stageResult} />
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

interface StageDetailsProps {
  stageResult: DiagnosticStageResult;
}

const StageDetails = ({ stageResult }: StageDetailsProps) => {
  const details = stageResult.details as Record<string, unknown> | null;

  if (!details) return null;

  const renderDetailRow = (label: string, value: unknown) => {
    let displayValue: string;

    if (Array.isArray(value)) {
      displayValue = value.length > 0 ? value.join(", ") : "(none)";
    } else if (typeof value === "boolean") {
      displayValue = value ? "Yes" : "No";
    } else if (value === null || value === undefined) {
      displayValue = "(none)";
    } else if (typeof value === "number") {
      displayValue = value.toString();
    } else {
      displayValue = String(value);
    }

    return (
      <Flex key={label} py={1}>
        <Text color="gray.400" minWidth="180px">
          {label}
        </Text>
        <Text fontFamily="mono">{displayValue}</Text>
      </Flex>
    );
  };

  switch (stageResult.stage) {
    case DiagnosticStage.FeedState:
      return (
        <Stack spacing={0}>
          {renderDetailRow("Has Prior Articles", details.hasPriorArticles)}
          {renderDetailRow("Is First Run", details.isFirstRun)}
          {renderDetailRow("Stored Comparisons", details.storedComparisonNames)}
        </Stack>
      );

    case DiagnosticStage.IdComparison:
      return <Stack spacing={0}>{renderDetailRow("Is New", details.isNew)}</Stack>;

    case DiagnosticStage.BlockingComparison:
      return (
        <Stack spacing={0}>
          {renderDetailRow("Selected Fields", details.comparisonFields)}
          {renderDetailRow("Available Fields", details.activeFields)}
          {renderDetailRow("Blocked By", details.blockedByFields)}
        </Stack>
      );

    case DiagnosticStage.PassingComparison:
      return (
        <Stack spacing={0}>
          {renderDetailRow("Selected Fields", details.comparisonFields)}
          {renderDetailRow("Available Fields", details.activeFields)}
          {renderDetailRow("Changed Fields", details.changedFields)}
        </Stack>
      );

    case DiagnosticStage.DateCheck: {
      const formatDuration = (ms: number): string => {
        const totalHours = Math.floor(ms / 3600000);
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;

        if (days > 0 && hours > 0) {
          return `${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""}`;
        }

        if (days > 0) {
          return `${days} day${days !== 1 ? "s" : ""}`;
        }

        return `${hours} hour${hours !== 1 ? "s" : ""}`;
      };

      return (
        <Stack spacing={0}>
          {renderDetailRow("Article Date", details.articleDate)}
          {renderDetailRow(
            "Age",
            details.ageMs ? formatDuration(details.ageMs as number) : "(unknown)"
          )}
          {renderDetailRow(
            "Maximum Age",
            details.threshold
              ? `${Math.round((details.threshold as number) / 86400000)} days`
              : "(none)"
          )}
          {renderDetailRow("Within Limit", details.withinThreshold)}
        </Stack>
      );
    }

    case DiagnosticStage.MediumFilter:
      return (
        <Stack spacing={0}>
          {renderDetailRow("Filter Result", details.filterResult ? "Passed" : "Blocked")}
          {Array.isArray(details.explainBlocked) && details.explainBlocked.length > 0 && (
            <Box py={1}>
              <Text color="gray.400" mb={1}>
                Blocked Because:
              </Text>
              {(details.explainBlocked as string[]).map((reason, idx) => (
                <Text key={idx} pl={4}>
                  • {reason}
                </Text>
              ))}
            </Box>
          )}
        </Stack>
      );

    case DiagnosticStage.FeedRateLimit:
    case DiagnosticStage.MediumRateLimit:
      return (
        <Stack spacing={0}>
          {renderDetailRow("Current Count", `${details.currentCount} articles`)}
          {renderDetailRow("Limit", `${details.limit} articles`)}
          {renderDetailRow(
            "Time Window",
            details.timeWindowSeconds === 86400
              ? "1 day"
              : `${Math.round((details.timeWindowSeconds as number) / 3600)} hours`
          )}
          {renderDetailRow("Remaining", `${details.remaining} articles`)}
          {renderDetailRow("Over Limit", details.wouldExceed)}
        </Stack>
      );

    default:
      return (
        <Stack spacing={0}>
          {Object.entries(details).map(([key, value]) => renderDetailRow(key, value))}
        </Stack>
      );
  }
};

interface LearningPhaseContentProps {
  refreshRateSeconds: number;
}

const LearningPhaseContent = ({ refreshRateSeconds }: LearningPhaseContentProps) => {
  const formattedTime = formatRefreshRateSeconds(refreshRateSeconds);

  return (
    <Box textAlign="center" py={8}>
      <Box
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        bg="blue.900"
        borderRadius="full"
        p={3}
        mb={4}
      >
        <InfoIcon boxSize={6} color="blue.300" />
      </Box>
      <Text fontSize="lg" fontWeight="semibold" mb={2}>
        Learning Phase Active
      </Text>
      <Text color="whiteAlpha.800" maxW="md" mx="auto">
        This feed is in its learning phase. MonitoRSS is identifying existing articles so it only
        delivers new ones.
      </Text>
      <Box bg="blue.900" p={3} borderRadius="md" mt={4} maxW="sm" mx="auto">
        <Text fontWeight="medium" color="blue.200">
          Expected completion: Within {formattedTime}
        </Text>
        <Text fontSize="sm" color="blue.300">
          Based on your feed&apos;s refresh interval
        </Text>
      </Box>
      <Text color="whiteAlpha.600" mt={4} fontSize="sm">
        Delivery checks will be available once the feed begins normal operation.
      </Text>
    </Box>
  );
};

const FeedUnchangedContent = () => (
  <Box textAlign="center" py={8}>
    <Box
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.700"
      borderRadius="full"
      p={3}
      mb={4}
    >
      <RepeatIcon boxSize={6} color="gray.400" />
    </Box>
    <Text fontSize="lg" fontWeight="semibold" mb={2}>
      Feed Content Unchanged
    </Text>
    <Text color="whiteAlpha.800" maxW="md" mx="auto">
      The feed content has not changed since it was last checked. MonitoRSS skips processing when
      the feed is identical to avoid unnecessary work.
    </Text>
    <Text color="whiteAlpha.600" mt={4} fontSize="sm">
      Delivery checks run when new or updated content is detected.
    </Text>
  </Box>
);

interface FeedErrorContentProps {
  outcomeReason: string;
}

const FeedErrorContent = ({ outcomeReason }: FeedErrorContentProps) => (
  <Box textAlign="center" py={8}>
    <Box
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      bg="red.900"
      borderRadius="full"
      p={3}
      mb={4}
    >
      <WarningIcon boxSize={6} color="red.300" />
    </Box>
    <Text fontSize="lg" fontWeight="semibold" mb={2}>
      Feed Error
    </Text>
    <Text color="whiteAlpha.800" maxW="md" mx="auto">
      MonitoRSS could not fetch or process this feed. Article-level checks were not performed.
    </Text>
    {outcomeReason && (
      <Box bg="red.900" p={3} borderRadius="md" mt={4} maxW="md" mx="auto">
        <Text fontSize="sm" color="red.200" fontFamily="mono">
          {outcomeReason}
        </Text>
      </Box>
    )}
    <Text color="whiteAlpha.600" mt={4} fontSize="sm">
      Request History shows the full details for this fetch attempt.
    </Text>
  </Box>
);

export const DeliveryChecksModal = ({ isOpen, onClose, result, initialMediumId }: Props) => {
  const { userFeed } = useUserFeedContext();
  const [selectedMediumId, setSelectedMediumId] = useState(
    initialMediumId || result.mediumResults[0]?.mediumId
  );

  const isLearningPhase = result.outcome === ArticleDiagnosisOutcome.FirstRunBaseline;
  const isFeedUnchanged = result.outcome === ArticleDiagnosisOutcome.FeedUnchanged;
  const isFeedError = result.outcome === ArticleDiagnosisOutcome.FeedError;
  const hasNoStages = isLearningPhase || isFeedUnchanged || isFeedError;

  useEffect(() => {
    if (isOpen && initialMediumId) {
      setSelectedMediumId(initialMediumId);
    }
  }, [isOpen, initialMediumId]);

  const selectedMediumResult = result.mediumResults.find((m) => m.mediumId === selectedMediumId);
  const stages = selectedMediumResult?.stages || [];

  const failedStageIndex = stages.findIndex((s) => s.status === DiagnosticStageStatus.Failed);

  const getConnectionName = (mediumId: string) => {
    const connection = userFeed.connections.find((c) => c.id === mediumId);

    return connection?.name || mediumId;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="gray.900">
        <ModalHeader>
          <Stack spacing={1}>
            <Text>Delivery Checks</Text>
            <Text fontSize="sm" fontWeight="normal" color="whiteAlpha.700" noOfLines={1}>
              {result.articleTitle || "(no title)"}
            </Text>
          </Stack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isLearningPhase && (
            <LearningPhaseContent refreshRateSeconds={userFeed.refreshRateSeconds} />
          )}
          {isFeedUnchanged && <FeedUnchangedContent />}
          {isFeedError && <FeedErrorContent outcomeReason={result.outcomeReason} />}
          {!hasNoStages && (
            <Stack spacing={4}>
              {result.mediumResults.length > 1 && (
                <Box>
                  <Text fontSize="sm" color="gray.400" mb={1}>
                    Connection
                  </Text>
                  <Select
                    value={selectedMediumId}
                    onChange={(e) => setSelectedMediumId(e.target.value)}
                    bg="gray.800"
                    size="sm"
                  >
                    {result.mediumResults.map((mr) => (
                      <option key={mr.mediumId} value={mr.mediumId}>
                        {getConnectionName(mr.mediumId)}
                      </option>
                    ))}
                  </Select>
                </Box>
              )}
              <Stack spacing={1} key={selectedMediumId}>
                {stages.map((stageResult, index) => (
                  <StageRow
                    key={stageResult.stage}
                    stageResult={stageResult}
                    isAutoExpanded={index === failedStageIndex}
                  />
                ))}
              </Stack>
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
