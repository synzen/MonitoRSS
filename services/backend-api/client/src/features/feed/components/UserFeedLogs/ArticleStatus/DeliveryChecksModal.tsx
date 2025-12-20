import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Heading,
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
  Tag,
  Text,
  useDisclosure,
  VisuallyHidden,
} from "@chakra-ui/react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
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
  FilterExplainBlockedDetail,
} from "../../../types/ArticleDiagnostics";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";
import { FilterResultItem } from "./FilterResultItem";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: ArticleDiagnosticResult;
  initialMediumId?: string;
}

const getStageName = (stage: DiagnosticStage): string => {
  switch (stage) {
    case DiagnosticStage.FeedState:
      return "Initial Scan";
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
      return "Feed Daily Limit";
    case DiagnosticStage.MediumRateLimit:
      return "Connection Rate Limit";
    default:
      return stage;
  }
};

type ArticlePath = "new" | "seen";

function getArticlePath(stages: DiagnosticStageResult[]): ArticlePath {
  const idComparisonStage = stages.find((s) => s.stage === DiagnosticStage.IdComparison);

  if (idComparisonStage?.status === DiagnosticStageStatus.Passed) {
    return "new";
  }

  return "seen";
}

function getRelevantStages(
  stages: DiagnosticStageResult[],
  articlePath: ArticlePath
): DiagnosticStageResult[] {
  return stages.filter((stage) => {
    if (stage.stage === DiagnosticStage.PassingComparison && articlePath === "new") {
      return false;
    }

    if (stage.stage === DiagnosticStage.BlockingComparison && articlePath === "seen") {
      return false;
    }

    return stage.status !== DiagnosticStageStatus.Skipped;
  });
}

interface StatusSummaryProps {
  stages: DiagnosticStageResult[];
}

const StatusSummary = ({ stages }: StatusSummaryProps) => {
  const failedStage = stages.find((s) => s.status === DiagnosticStageStatus.Failed);
  const isSuccess = !failedStage;

  const bgColor = isSuccess ? "green.900" : "orange.900";
  const borderColor = isSuccess ? "green.600" : "orange.600";
  const iconColor = isSuccess ? "green.400" : "orange.400";

  return (
    <Box
      bg={bgColor}
      borderLeft="4px solid"
      borderLeftColor={borderColor}
      borderRadius="md"
      p={4}
      mb={4}
    >
      <HStack spacing={3} align="flex-start">
        <Box mt={0.5}>
          {isSuccess ? (
            <CheckIcon color={iconColor} boxSize={4} />
          ) : (
            <WarningIcon color={iconColor} boxSize={4} />
          )}
        </Box>
        <Box>
          <Text fontWeight="semibold" mb={1}>
            {isSuccess ? "Would deliver" : `Blocked at: ${getStageName(failedStage.stage)}`}
          </Text>
        </Box>
      </HStack>
    </Box>
  );
};

interface StatusIndicatorProps {
  status: DiagnosticStageStatus;
}

const StatusIndicator = ({ status }: StatusIndicatorProps) => {
  const isPassed = status === DiagnosticStageStatus.Passed;
  const isFailed = status === DiagnosticStageStatus.Failed;

  if (isPassed) {
    return (
      <HStack spacing={1} alignItems="center">
        <CheckIcon color="green.400" boxSize={3} aria-hidden="true" />
        <Text fontSize="xs" fontWeight="bold" color="green.400" textTransform="uppercase">
          Passed
        </Text>
      </HStack>
    );
  }

  if (isFailed) {
    return (
      <HStack spacing={1} alignItems="center">
        <CloseIcon color="orange.400" boxSize={3} aria-hidden="true" />
        <Text fontSize="xs" fontWeight="bold" color="orange.400" textTransform="uppercase">
          Blocked
        </Text>
      </HStack>
    );
  }

  return null;
};

interface PipelineStageProps {
  stageResult: DiagnosticStageResult;
  stepNumber: number;
  totalSteps: number;
  isLast: boolean;
  defaultExpanded?: boolean;
}

const PipelineStage = ({
  stageResult,
  stepNumber,
  totalSteps,
  isLast,
  defaultExpanded = false,
}: PipelineStageProps) => {
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: defaultExpanded });
  const isPassed = stageResult.status === DiagnosticStageStatus.Passed;
  const isFailed = stageResult.status === DiagnosticStageStatus.Failed;
  const hasDetails = !!stageResult.details;

  const getCircleColor = () => {
    if (isPassed) return "green.500";
    if (isFailed) return "orange.500";

    return "gray.500";
  };

  const circleColor = getCircleColor();
  const lineColor = isPassed ? "green.500" : "gray.600";

  return (
    <Box as="li" aria-current={isFailed ? "step" : undefined}>
      <Flex>
        {/* Step indicator column */}
        <Flex direction="column" alignItems="center" mr={4} aria-hidden="true">
          {/* Status circle */}
          <Flex
            alignItems="center"
            justifyContent="center"
            w={8}
            h={8}
            borderRadius="full"
            bg={circleColor}
            color="white"
            fontWeight="bold"
            fontSize="sm"
          >
            {isPassed && <CheckIcon boxSize={3} />}
            {isFailed && <CloseIcon boxSize={3} />}
            {!isPassed && !isFailed && stepNumber}
          </Flex>
          {/* Connecting line */}
          {!isLast && <Box w="2px" flex={1} minH={4} bg={lineColor} />}
        </Flex>
        {/* Content column */}
        <Box flex={1} pb={isLast ? 0 : 6}>
          <VisuallyHidden>
            Step {stepNumber} of {totalSteps}:
          </VisuallyHidden>
          <Flex alignItems="baseline" justifyContent="space-between" gap={2} mb={1}>
            <Text fontWeight="semibold">{getStageName(stageResult.stage)}</Text>
            <StatusIndicator status={stageResult.status} />
          </Flex>
          <Text fontSize="sm" color="whiteAlpha.700" mb={hasDetails ? 2 : 0}>
            {stageResult.summary}
          </Text>
          {hasDetails && (
            <>
              <Button
                size="xs"
                variant="ghost"
                onClick={onToggle}
                rightIcon={isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                aria-expanded={isOpen}
                color="whiteAlpha.600"
                aria-controls={stageResult.stage}
                _hover={{ color: "whiteAlpha.900" }}
              >
                {isOpen ? "Hide details" : "Show details"}
              </Button>
              <Collapse in={isOpen} id={stageResult.stage}>
                <Box mt={2} pl={4} borderLeft="2px solid" borderLeftColor="whiteAlpha.200">
                  <StageDetails stageResult={stageResult} />
                </Box>
              </Collapse>
            </>
          )}
        </Box>
      </Flex>
    </Box>
  );
};

interface StagesPipelineProps {
  stages: DiagnosticStageResult[];
}

const StagesPipeline = ({ stages }: StagesPipelineProps) => {
  const failedStageIndex = stages.findIndex((s) => s.status === DiagnosticStageStatus.Failed);

  return (
    <Box as="ol" listStyleType="none" m={0} p={0} aria-label="Article delivery pipeline stages">
      {stages.map((stage, index) => (
        <PipelineStage
          key={stage.stage}
          stageResult={stage}
          stepNumber={index + 1}
          totalSteps={stages.length}
          isLast={index === stages.length - 1}
          defaultExpanded={index === failedStageIndex}
        />
      ))}
    </Box>
  );
};

interface FieldTagsProps {
  fields: string[];
  colorScheme?: "orange" | "green" | "gray";
}

const FieldTags = ({ fields, colorScheme = "gray" }: FieldTagsProps) => {
  if (!fields || fields.length === 0) {
    return (
      <Text as="span" color="gray.500" fontStyle="italic">
        (none)
      </Text>
    );
  }

  return (
    <HStack spacing={1} display="inline-flex" flexWrap="wrap">
      {fields.map((field) => (
        <Tag key={field} size="sm" colorScheme={colorScheme} fontFamily="mono">
          {field}
        </Tag>
      ))}
    </HStack>
  );
};

interface TechnicalDetailsProps {
  children: React.ReactNode;
}

const TechnicalDetails = ({ children }: TechnicalDetailsProps) => {
  const { isOpen, onToggle } = useDisclosure();

  return (
    <Box mt={3}>
      <Button
        size="xs"
        variant="ghost"
        onClick={onToggle}
        color="whiteAlpha.500"
        _hover={{ color: "whiteAlpha.700" }}
        px={0}
      >
        {isOpen ? "Hide technical details" : "Show technical details"}
      </Button>
      <Collapse in={isOpen}>
        <Grid
          as="dl"
          templateColumns="180px 1fr"
          gap={0}
          fontSize="xs"
          mt={2}
          p={2}
          bg="whiteAlpha.50"
          borderRadius="md"
          color="whiteAlpha.600"
        >
          {children}
        </Grid>
      </Collapse>
    </Box>
  );
};

interface TechnicalRowProps {
  label: string;
  value: unknown;
}

const TechnicalRow = ({ label, value }: TechnicalRowProps) => {
  const formatValue = (val: unknown): string => {
    if (Array.isArray(val)) {
      return val.length > 0 ? val.join(", ") : "(none)";
    }

    if (typeof val === "boolean") {
      return val ? "Yes" : "No";
    }

    if (val === null || val === undefined) {
      return "(none)";
    }

    return String(val);
  };

  return (
    <>
      <Box as="dt" py={1}>
        {label}
      </Box>
      <Box as="dd" fontFamily="mono" py={1} ml={0}>
        {formatValue(value)}
      </Box>
    </>
  );
};

interface StageDetailsProps {
  stageResult: DiagnosticStageResult;
}

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

  if (hours === 0) {
    const minutes = Math.floor(ms / 60000);

    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  return `${hours} hour${hours !== 1 ? "s" : ""}`;
};

const formatTimeWindow = (seconds: number): string => {
  const hours = Math.round(seconds / 3600);

  if (hours === 24) return "24 hours";
  if (hours === 1) return "1 hour";

  return `${hours} hours`;
};

const StageDetails = ({ stageResult }: StageDetailsProps) => {
  const details = stageResult.details as Record<string, unknown> | null;
  const isFailed = stageResult.status === DiagnosticStageStatus.Failed;

  if (!details) return null;

  switch (stageResult.stage) {
    case DiagnosticStage.FeedState: {
      const isFirstRun = details.isFirstRun as boolean;

      if (isFirstRun) {
        return (
          <Text fontSize="sm">
            This is the first time this feed is being checked. All articles are being catalogued for
            future comparison.
          </Text>
        );
      }

      return (
        <Text fontSize="sm">
          Feed state loaded successfully. This feed has delivered articles before.
        </Text>
      );
    }

    case DiagnosticStage.IdComparison: {
      const isNew = details.isNew as boolean;

      if (isNew) {
        return (
          <Text fontSize="sm">
            This article has a unique identifier and hasn&apos;t been seen before.
          </Text>
        );
      }

      return (
        <Text fontSize="sm">
          This article was already delivered. The article&apos;s unique identifier matches one
          we&apos;ve seen before.
        </Text>
      );
    }

    case DiagnosticStage.BlockingComparison: {
      const comparisonFields = details.comparisonFields as string[];
      const blockedByFields = details.blockedByFields as string[];

      if (isFailed && blockedByFields.length > 0) {
        return (
          <Stack spacing={3}>
            <Text fontSize="sm">
              This article was blocked because the{" "}
              <FieldTags fields={blockedByFields} colorScheme="orange" />{" "}
              {blockedByFields.length === 1 ? "field hasn't" : "fields haven't"} changed since it
              was last seen.
            </Text>
            {comparisonFields.length > 0 && (
              <Text fontSize="sm" color="whiteAlpha.700">
                You&apos;ve configured blocking comparisons on{" "}
                <FieldTags fields={comparisonFields} /> to prevent re-delivery of unchanged
                articles.
              </Text>
            )}
            <TechnicalDetails>
              <TechnicalRow label="Selected Fields" value={comparisonFields} />
              <TechnicalRow label="Available Fields" value={details.activeFields} />
              <TechnicalRow label="Blocked By" value={blockedByFields} />
            </TechnicalDetails>
          </Stack>
        );
      }

      if (comparisonFields.length === 0) {
        return <Text fontSize="sm">No blocking comparisons are configured for this feed.</Text>;
      }

      return (
        <Text fontSize="sm">
          No blocking comparisons triggered. The selected fields have changed since last delivery.
        </Text>
      );
    }

    case DiagnosticStage.PassingComparison: {
      const comparisonFields = details.comparisonFields as string[];
      const changedFields = details.changedFields as string[];

      if (isFailed) {
        return (
          <Stack spacing={3}>
            <Text fontSize="sm">
              None of the fields you selected for passing comparison have changed.
            </Text>
            {comparisonFields.length > 0 && (
              <Text fontSize="sm" color="whiteAlpha.700">
                You&apos;ve set up passing comparisons on <FieldTags fields={comparisonFields} /> to
                only deliver articles when those specific fields change.
              </Text>
            )}
            <TechnicalDetails>
              <TechnicalRow label="Selected Fields" value={comparisonFields} />
              <TechnicalRow label="Available Fields" value={details.activeFields} />
              <TechnicalRow label="Changed Fields" value={changedFields} />
            </TechnicalDetails>
          </Stack>
        );
      }

      if (comparisonFields.length === 0) {
        return (
          <Text fontSize="sm">
            No passing comparisons are configured. Articles pass through without field change
            requirements.
          </Text>
        );
      }

      return (
        <Text fontSize="sm">
          The <FieldTags fields={changedFields} colorScheme="green" />{" "}
          {changedFields.length === 1 ? "field" : "fields"} changed, which triggered delivery based
          on your passing comparison settings.
        </Text>
      );
    }

    case DiagnosticStage.DateCheck: {
      const ageMs = details.ageMs as number | null;
      const threshold = details.threshold as number | null;
      const withinThreshold = details.withinThreshold as boolean;
      const ageText = ageMs ? formatDuration(ageMs) : "unknown age";
      const thresholdDays = threshold ? Math.round(threshold / 86400000) : null;
      const thresholdText = thresholdDays
        ? `${thresholdDays} day${thresholdDays !== 1 ? "s" : ""}`
        : null;

      if (!withinThreshold && thresholdText) {
        return (
          <Stack spacing={3}>
            <Text fontSize="sm">
              This article is{" "}
              <Text as="span" fontWeight="semibold">
                {ageText}
              </Text>{" "}
              old, which exceeds your maximum age limit of{" "}
              <Text as="span" fontWeight="semibold">
                {thresholdText}
              </Text>
              . Older articles are skipped to prevent flooding your channel with outdated content.
            </Text>
            <TechnicalDetails>
              <TechnicalRow label="Article Date" value={details.articleDate} />
              <TechnicalRow label="Age" value={ageText} />
              <TechnicalRow label="Maximum Age" value={thresholdText} />
            </TechnicalDetails>
          </Stack>
        );
      }

      if (!thresholdText) {
        return (
          <Text fontSize="sm">
            No date limit is configured. Articles of any age will be delivered.
          </Text>
        );
      }

      return (
        <Text fontSize="sm">
          This article is{" "}
          <Text as="span" fontWeight="semibold">
            {ageText}
          </Text>{" "}
          old, which is within your{" "}
          <Text as="span" fontWeight="semibold">
            {thresholdText}
          </Text>{" "}
          limit.
        </Text>
      );
    }

    case DiagnosticStage.MediumFilter: {
      const filterResult = details.filterResult as boolean;
      const explainBlocked = (details.explainBlocked as FilterExplainBlockedDetail[]) || [];
      const explainMatched = (details.explainMatched as FilterExplainBlockedDetail[]) || [];
      const hasNoFilters = explainBlocked.length === 0 && explainMatched.length === 0;

      if (hasNoFilters) {
        return (
          <Text fontSize="sm">
            No filters are configured for this connection. All articles pass through.
          </Text>
        );
      }

      return (
        <Stack spacing={4}>
          {!filterResult && explainBlocked.length > 0 && (
            <Box>
              <Text fontSize="sm" mb={3}>
                This article was blocked by your connection filters.
              </Text>
              <Stack spacing={2}>
                {explainBlocked.map((detail) => (
                  <FilterResultItem
                    key={`${detail.fieldName}-${detail.operator}-${detail.filterInput}`}
                    detail={detail}
                  />
                ))}
              </Stack>
            </Box>
          )}
          {filterResult && <Text fontSize="sm">This article matched your filter criteria.</Text>}
          {explainMatched.length > 0 && (
            <Box>
              <Text fontSize="sm" color="whiteAlpha.600" mb={2}>
                {!filterResult ? "Other filters that matched:" : "Matched filters:"}
              </Text>
              <Stack spacing={2}>
                {explainMatched.map((detail) => (
                  <FilterResultItem
                    key={`${detail.fieldName}-${detail.operator}-${detail.filterInput}`}
                    detail={detail}
                    matched
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      );
    }

    case DiagnosticStage.FeedRateLimit:
    // falls through

    case DiagnosticStage.MediumRateLimit: {
      const currentCount = details.currentCount as number;
      const limit = details.limit as number;
      const remaining = details.remaining as number;
      const timeWindowSeconds = details.timeWindowSeconds as number;
      const wouldExceed = details.wouldExceed as boolean;
      const timeWindowText = formatTimeWindow(timeWindowSeconds);
      const isConnectionLimit = stageResult.stage === DiagnosticStage.MediumRateLimit;

      if (wouldExceed) {
        return (
          <Stack spacing={2}>
            <Text fontSize="sm">
              {isConnectionLimit ? "Connection" : "Feed"} rate limit reached.{" "}
              <Text as="span" fontWeight="semibold">
                {currentCount}
              </Text>{" "}
              articles have been delivered in the last{" "}
              <Text as="span" fontWeight="semibold">
                {timeWindowText}
              </Text>
              , hitting the{" "}
              <Text as="span" fontWeight="semibold">
                {limit}
              </Text>{" "}
              article limit.
            </Text>
            <Text fontSize="sm" color="whiteAlpha.700">
              New articles will be allowed as older deliveries fall outside the {timeWindowText}{" "}
              window.
            </Text>
          </Stack>
        );
      }

      return (
        <Text fontSize="sm">
          <Text as="span" fontWeight="semibold">
            {currentCount}
          </Text>{" "}
          of{" "}
          <Text as="span" fontWeight="semibold">
            {limit}
          </Text>{" "}
          articles delivered in the last {timeWindowText}.{" "}
          <Text as="span" fontWeight="semibold">
            {remaining}
          </Text>{" "}
          remaining.
        </Text>
      );
    }

    default:
      return null;
  }
};

interface LearningPhaseContentProps {
  refreshRateSeconds: number;
}

const LearningPhaseContent = ({ refreshRateSeconds }: LearningPhaseContentProps) => {
  const formattedTime = formatRefreshRateSeconds(refreshRateSeconds);

  return (
    <Box textAlign="center" py={8} role="status">
      <Box
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        bg="blue.900"
        borderRadius="full"
        p={3}
        mb={4}
      >
        <InfoIcon boxSize={6} color="blue.300" aria-hidden="true" />
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
  <Box textAlign="center" py={8} role="status">
    <Box
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.700"
      borderRadius="full"
      p={3}
      mb={4}
    >
      <RepeatIcon boxSize={6} color="gray.400" aria-hidden="true" />
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
      <WarningIcon boxSize={6} color="red.300" aria-hidden="true" />
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
  const articlePath = getArticlePath(stages);
  const relevantStages = getRelevantStages(stages, articlePath);

  const getConnectionName = (mediumId: string) => {
    const connection = userFeed.connections.find((c) => c.id === mediumId);

    return connection?.name || mediumId;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="gray.900">
        <ModalHeader as="div">
          <Stack spacing={1}>
            <Heading as="h2" size="md">
              Delivery Checks
            </Heading>
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
                <FormControl>
                  <FormLabel htmlFor="connection-select" fontSize="sm" color="gray.400">
                    Connection
                  </FormLabel>
                  <Select
                    id="connection-select"
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
                </FormControl>
              )}
              <StatusSummary stages={relevantStages} />
              <StagesPipeline key={selectedMediumId} stages={relevantStages} />
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
