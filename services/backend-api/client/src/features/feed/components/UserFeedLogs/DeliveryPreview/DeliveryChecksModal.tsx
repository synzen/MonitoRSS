import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  useDisclosure,
  VisuallyHidden,
} from "@chakra-ui/react";
import {
  FaCheck,
  FaChevronDown,
  FaChevronUp,
  FaXmark,
  FaCircleInfo,
  FaArrowsRotate,
  FaTriangleExclamation,
} from "react-icons/fa6";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NativeSelectRoot, NativeSelectField } from "@/components/ui/native-select";
import { Tag } from "@/components/ui/tag";
import {
  formatRefreshRateSeconds,
  getEffectiveRefreshRateSeconds,
} from "../../../../../utils/formatRefreshRateSeconds";
import {
  ArticleDeliveryOutcome,
  ArticleDeliveryResult,
  DeliveryPreviewStage,
  DeliveryPreviewStageResult,
  DeliveryPreviewStageStatus,
  FilterExplainBlockedDetail,
} from "../../../types/DeliveryPreview";
import { useUserFeedContext } from "../../../contexts/UserFeedContext";
import { FilterResultItem } from "./FilterResultItem";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: ArticleDeliveryResult;
  initialMediumId?: string;
}

const getStageName = (stage: DeliveryPreviewStage): string => {
  switch (stage) {
    case DeliveryPreviewStage.FeedState:
      return "Initial Scan";
    case DeliveryPreviewStage.IdComparison:
      return "Duplicate Check";
    case DeliveryPreviewStage.BlockingComparison:
      return "Blocking Comparison";
    case DeliveryPreviewStage.PassingComparison:
      return "Passing Comparison";
    case DeliveryPreviewStage.DateCheck:
      return "Date Check";
    case DeliveryPreviewStage.MediumFilter:
      return "Connection Filters";
    case DeliveryPreviewStage.FeedRateLimit:
      return "Feed Daily Limit";
    case DeliveryPreviewStage.MediumRateLimit:
      return "Connection Rate Limit";
    default:
      return stage;
  }
};

type ArticlePath = "new" | "seen";

function getArticlePath(stages: DeliveryPreviewStageResult[]): ArticlePath {
  const idComparisonStage = stages.find((s) => s.stage === DeliveryPreviewStage.IdComparison);

  if (idComparisonStage?.status === DeliveryPreviewStageStatus.Passed) {
    return "new";
  }

  return "seen";
}

function getRelevantStages(
  stages: DeliveryPreviewStageResult[],
  articlePath: ArticlePath,
): DeliveryPreviewStageResult[] {
  return stages.filter((stage) => {
    if (stage.stage === DeliveryPreviewStage.PassingComparison && articlePath === "new") {
      return false;
    }

    if (stage.stage === DeliveryPreviewStage.BlockingComparison && articlePath === "seen") {
      return false;
    }

    return stage.status !== DeliveryPreviewStageStatus.Skipped;
  });
}

interface StatusSummaryProps {
  stages: DeliveryPreviewStageResult[];
}

const StatusSummary = ({ stages }: StatusSummaryProps) => {
  const failedStage = stages.find((s) => s.status === DeliveryPreviewStageStatus.Failed);
  const isSuccess = !failedStage;

  const colorPalette = isSuccess ? "green" : "orange";
  const iconColor = isSuccess ? "text.success" : "text.warning";

  return (
    <Box
      colorPalette={colorPalette}
      bg="colorPalette.subtle"
      borderLeft="4px solid"
      borderLeftColor="colorPalette.500"
      borderRadius="l3"
      p={4}
      mb={4}
    >
      <HStack gap={3} align="flex-start">
        <Box mt={0.5}>
          {isSuccess ? (
            <Icon as={FaCheck} color={iconColor} boxSize={4} />
          ) : (
            <Icon as={FaTriangleExclamation} color={iconColor} boxSize={4} />
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
  status: DeliveryPreviewStageStatus;
}

const StatusIndicator = ({ status }: StatusIndicatorProps) => {
  const isPassed = status === DeliveryPreviewStageStatus.Passed;
  const isFailed = status === DeliveryPreviewStageStatus.Failed;

  if (isPassed) {
    return (
      <HStack gap={1} alignItems="center">
        <Icon as={FaCheck} color="text.success" boxSize={3} aria-hidden="true" />
        <Text fontSize="xs" fontWeight="bold" color="text.success" textTransform="uppercase">
          Passed
        </Text>
      </HStack>
    );
  }

  if (isFailed) {
    return (
      <HStack gap={1} alignItems="center">
        <Icon as={FaXmark} color="text.warning" boxSize={3} aria-hidden="true" />
        <Text fontSize="xs" fontWeight="bold" color="text.warning" textTransform="uppercase">
          Blocked
        </Text>
      </HStack>
    );
  }

  return null;
};

interface PipelineStageProps {
  stageResult: DeliveryPreviewStageResult;
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
  const { open, onToggle } = useDisclosure({ defaultOpen: defaultExpanded });
  const isPassed = stageResult.status === DeliveryPreviewStageStatus.Passed;
  const isFailed = stageResult.status === DeliveryPreviewStageStatus.Failed;
  const hasDetails = !!stageResult.details;

  const getCirclePalette = () => {
    if (isPassed) return "green";
    if (isFailed) return "orange";

    return "gray";
  };

  const circlePalette = getCirclePalette();

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
            colorPalette={circlePalette}
            bg="colorPalette.500"
            color="white"
            fontWeight="bold"
            fontSize="sm"
          >
            {isPassed && <Icon as={FaCheck} boxSize={3} />}
            {isFailed && <Icon as={FaXmark} boxSize={3} />}
            {!isPassed && !isFailed && stepNumber}
          </Flex>
          {/* Connecting line */}
          {!isLast && (
            <Box
              w="2px"
              flex={1}
              minH={4}
              colorPalette={isPassed ? "green" : undefined}
              bg={isPassed ? "colorPalette.500" : "border"}
            />
          )}
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
          <Text fontSize="sm" color="fg.muted" mb={hasDetails ? 2 : 0}>
            {stageResult.summary}
          </Text>
          {hasDetails && (
            <>
              <Button
                size="xs"
                variant="ghost"
                onClick={onToggle}
                aria-expanded={open}
                color="fg.muted"
                aria-controls={stageResult.stage}
                _hover={{ color: "fg" }}
              >
                {open ? "Hide details" : "Show details"}
                <Icon as={open ? FaChevronUp : FaChevronDown} />
              </Button>
              {open && (
                <Box
                  id={stageResult.stage}
                  mt={2}
                  pl={4}
                  borderLeft="2px solid"
                  borderLeftColor="border"
                >
                  <StageDetails stageResult={stageResult} />
                </Box>
              )}
            </>
          )}
        </Box>
      </Flex>
    </Box>
  );
};

interface StagesPipelineProps {
  stages: DeliveryPreviewStageResult[];
}

const StagesPipeline = ({ stages }: StagesPipelineProps) => {
  const failedStageIndex = stages.findIndex((s) => s.status === DeliveryPreviewStageStatus.Failed);

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
  colorPalette?: "orange" | "green" | "gray";
}

const FieldTags = ({ fields, colorPalette = "gray" }: FieldTagsProps) => {
  if (!fields || fields.length === 0) {
    return (
      <Text as="span" color="fg.muted" fontStyle="italic">
        (none)
      </Text>
    );
  }

  return (
    <HStack gap={1} display="inline-flex" flexWrap="wrap">
      {fields.map((field) => (
        <Tag key={field} size="sm" colorPalette={colorPalette} fontFamily="mono">
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
  const { open, onToggle } = useDisclosure();

  return (
    <Box mt={3}>
      <Button
        size="xs"
        variant="ghost"
        onClick={onToggle}
        color="fg.muted"
        _hover={{ color: "fg.muted" }}
        px={0}
      >
        {open ? "Hide technical details" : "Show technical details"}
      </Button>
      {open && (
        <Grid
          as="dl"
          templateColumns="180px 1fr"
          gap={0}
          fontSize="xs"
          mt={2}
          p={2}
          bg="bg.subtle"
          borderRadius="l3"
          color="fg.muted"
        >
          {children}
        </Grid>
      )}
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
  stageResult: DeliveryPreviewStageResult;
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
  const isFailed = stageResult.status === DeliveryPreviewStageStatus.Failed;

  if (!details) return null;

  switch (stageResult.stage) {
    case DeliveryPreviewStage.FeedState: {
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

    case DeliveryPreviewStage.IdComparison: {
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

    case DeliveryPreviewStage.BlockingComparison: {
      const comparisonFields = details.comparisonFields as string[];
      const blockedByFields = details.blockedByFields as string[];

      if (isFailed && blockedByFields.length > 0) {
        return (
          <Stack gap={3}>
            <Text fontSize="sm">
              This article was blocked because the{" "}
              <FieldTags fields={blockedByFields} colorPalette="orange" />{" "}
              {blockedByFields.length === 1 ? "field hasn't" : "fields haven't"} changed since it
              was last seen.
            </Text>
            {comparisonFields.length > 0 && (
              <Text fontSize="sm" color="fg.muted">
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

    case DeliveryPreviewStage.PassingComparison: {
      const comparisonFields = details.comparisonFields as string[];
      const changedFields = details.changedFields as string[];

      if (isFailed) {
        return (
          <Stack gap={3}>
            <Text fontSize="sm">
              None of the fields you selected for passing comparison have changed.
            </Text>
            {comparisonFields.length > 0 && (
              <Text fontSize="sm" color="fg.muted">
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
          The <FieldTags fields={changedFields} colorPalette="green" />{" "}
          {changedFields.length === 1 ? "field" : "fields"} changed, which triggered delivery based
          on your passing comparison settings.
        </Text>
      );
    }

    case DeliveryPreviewStage.DateCheck: {
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
          <Stack gap={3}>
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

    case DeliveryPreviewStage.MediumFilter: {
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
        <Stack gap={4}>
          {!filterResult && explainBlocked.length > 0 && (
            <Box>
              <Text fontSize="sm" mb={3}>
                This article was blocked by your connection filters.
              </Text>
              <Stack gap={2}>
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
              <Text fontSize="sm" color="fg.muted" mb={2}>
                {!filterResult ? "Other filters that matched:" : "Matched filters:"}
              </Text>
              <Stack gap={2}>
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

    case DeliveryPreviewStage.FeedRateLimit:
    // falls through

    case DeliveryPreviewStage.MediumRateLimit: {
      const currentCount = details.currentCount as number;
      const limit = details.limit as number;
      const remaining = details.remaining as number;
      const timeWindowSeconds = details.timeWindowSeconds as number;
      const wouldExceed = details.wouldExceed as boolean;
      const timeWindowText = formatTimeWindow(timeWindowSeconds);
      const isConnectionLimit = stageResult.stage === DeliveryPreviewStage.MediumRateLimit;

      if (wouldExceed) {
        return (
          <Stack gap={2}>
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
            <Text fontSize="sm" color="fg.muted">
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
        colorPalette="brand"
        bg="colorPalette.subtle"
        borderRadius="full"
        p={3}
        mb={4}
      >
        <Icon as={FaCircleInfo} boxSize={6} color="colorPalette.fg" aria-hidden="true" />
      </Box>
      <Text fontSize="lg" fontWeight="semibold" mb={2}>
        Learning Phase Active
      </Text>
      <Text color="fg" maxW="md" mx="auto">
        This feed is in its learning phase. MonitoRSS is identifying existing articles so it only
        delivers new ones.
      </Text>
      <Box
        colorPalette="brand"
        bg="colorPalette.subtle"
        p={3}
        borderRadius="l3"
        mt={4}
        maxW="sm"
        mx="auto"
      >
        <Text fontWeight="medium" color="colorPalette.fg">
          Expected completion: Within {formattedTime}
        </Text>
        <Text fontSize="sm" color="colorPalette.fg">
          Based on your feed&apos;s refresh interval
        </Text>
      </Box>
      <Text color="fg.muted" mt={4} fontSize="sm">
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
      bg="bg.emphasized"
      borderRadius="full"
      p={3}
      mb={4}
    >
      <Icon as={FaArrowsRotate} boxSize={6} color="fg.muted" aria-hidden="true" />
    </Box>
    <Text fontSize="lg" fontWeight="semibold" mb={2}>
      Feed Content Unchanged
    </Text>
    <Text color="fg" maxW="md" mx="auto">
      The feed content has not changed since it was last checked. MonitoRSS skips processing when
      the feed is identical to avoid unnecessary work.
    </Text>
    <Text color="fg.muted" mt={4} fontSize="sm">
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
      colorPalette="red"
      bg="colorPalette.subtle"
      borderRadius="full"
      p={3}
      mb={4}
    >
      <Icon as={FaTriangleExclamation} boxSize={6} color="text.error" aria-hidden="true" />
    </Box>
    <Text fontSize="lg" fontWeight="semibold" mb={2}>
      Feed Error
    </Text>
    <Text color="fg" maxW="md" mx="auto">
      MonitoRSS could not fetch or process this feed. Article-level checks were not performed.
    </Text>
    {outcomeReason && (
      <Box
        colorPalette="red"
        bg="colorPalette.subtle"
        p={3}
        borderRadius="l3"
        mt={4}
        maxW="md"
        mx="auto"
      >
        <Text fontSize="sm" color="text.error" fontFamily="mono">
          {outcomeReason}
        </Text>
      </Box>
    )}
    <Text color="fg.muted" mt={4} fontSize="sm">
      Request History shows the full details for this fetch attempt.
    </Text>
  </Box>
);

export const DeliveryChecksModal = ({ isOpen, onClose, result, initialMediumId }: Props) => {
  const { userFeed } = useUserFeedContext();
  const [selectedMediumId, setSelectedMediumId] = useState(
    initialMediumId || result.mediumResults[0]?.mediumId,
  );

  const isLearningPhase = result.outcome === ArticleDeliveryOutcome.FirstRunBaseline;
  const isFeedUnchanged = result.outcome === ArticleDeliveryOutcome.FeedUnchanged;
  const isFeedError = result.outcome === ArticleDeliveryOutcome.FeedError;
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
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="xl"
      scrollBehavior="inside"
    >
      <DialogContent>
        <DialogHeader marginRight={4}>
          <DialogTitle>
            <Stack gap={1}>
              <Heading as="h2" size="md">
                Delivery Checks
              </Heading>
              <Text fontSize="sm" fontWeight="normal" color="fg.muted" lineClamp={1}>
                {result.articleTitle || "(no title)"}
              </Text>
            </Stack>
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          {isLearningPhase && (
            <LearningPhaseContent refreshRateSeconds={getEffectiveRefreshRateSeconds(userFeed)} />
          )}
          {isFeedUnchanged && <FeedUnchangedContent />}
          {isFeedError && <FeedErrorContent outcomeReason={result.outcomeReason} />}
          {!hasNoStages && (
            <Stack gap={4}>
              {result.mediumResults.length > 1 && (
                <Field label="Connection">
                  <NativeSelectRoot size="sm">
                    <NativeSelectField
                      id="connection-select"
                      value={selectedMediumId}
                      onChange={(e) => setSelectedMediumId(e.target.value)}
                    >
                      {result.mediumResults.map((mr) => (
                        <option key={mr.mediumId} value={mr.mediumId}>
                          {getConnectionName(mr.mediumId)}
                        </option>
                      ))}
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Field>
              )}
              <StatusSummary stages={relevantStages} />
              <StagesPipeline key={selectedMediumId} stages={relevantStages} />
            </Stack>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
