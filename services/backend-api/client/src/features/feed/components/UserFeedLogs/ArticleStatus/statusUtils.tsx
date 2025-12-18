import { CheckIcon, InfoIcon, RepeatIcon, WarningIcon, TimeIcon, CloseIcon } from "@chakra-ui/icons";
import { Icon } from "@chakra-ui/react";
import { ArticleDiagnosisOutcome } from "../../../types/ArticleDiagnostics";

export const getOutcomeLabel = (outcome: ArticleDiagnosisOutcome): string => {
  switch (outcome) {
    case ArticleDiagnosisOutcome.WouldDeliver:
      return "Would Deliver";
    case ArticleDiagnosisOutcome.FirstRunBaseline:
      return "Learning";
    case ArticleDiagnosisOutcome.DuplicateId:
      return "Previously Seen";
    case ArticleDiagnosisOutcome.BlockedByComparison:
      return "Unchanged";
    case ArticleDiagnosisOutcome.FilteredByDateCheck:
      return "Too Old";
    case ArticleDiagnosisOutcome.FilteredByMediumFilter:
      return "Blocked by Filters";
    case ArticleDiagnosisOutcome.RateLimitedFeed:
      return "Daily Limit Reached";
    case ArticleDiagnosisOutcome.RateLimitedMedium:
      return "Limit Reached";
    case ArticleDiagnosisOutcome.WouldDeliverPassingComparison:
      return "Would Deliver";
    default:
      return "Unknown";
  }
};

export const getOutcomeColorScheme = (outcome: ArticleDiagnosisOutcome): string => {
  switch (outcome) {
    case ArticleDiagnosisOutcome.WouldDeliver:
    case ArticleDiagnosisOutcome.WouldDeliverPassingComparison:
      return "green";
    case ArticleDiagnosisOutcome.FirstRunBaseline:
      return "blue";
    case ArticleDiagnosisOutcome.DuplicateId:
    case ArticleDiagnosisOutcome.BlockedByComparison:
      return "gray";
    case ArticleDiagnosisOutcome.FilteredByDateCheck:
    case ArticleDiagnosisOutcome.FilteredByMediumFilter:
      return "orange";
    case ArticleDiagnosisOutcome.RateLimitedFeed:
    case ArticleDiagnosisOutcome.RateLimitedMedium:
      return "yellow";
    default:
      return "gray";
  }
};

export const getOutcomeIcon = (outcome: ArticleDiagnosisOutcome) => {
  switch (outcome) {
    case ArticleDiagnosisOutcome.WouldDeliver:
    case ArticleDiagnosisOutcome.WouldDeliverPassingComparison:
      return CheckIcon;
    case ArticleDiagnosisOutcome.FirstRunBaseline:
      return InfoIcon;
    case ArticleDiagnosisOutcome.DuplicateId:
    case ArticleDiagnosisOutcome.BlockedByComparison:
      return RepeatIcon;
    case ArticleDiagnosisOutcome.FilteredByDateCheck:
    case ArticleDiagnosisOutcome.FilteredByMediumFilter:
      return WarningIcon;
    case ArticleDiagnosisOutcome.RateLimitedFeed:
    case ArticleDiagnosisOutcome.RateLimitedMedium:
      return TimeIcon;
    default:
      return CloseIcon;
  }
};

interface StatusBadgeContentProps {
  outcome: ArticleDiagnosisOutcome;
  label: string;
  isPartial?: boolean;
}

export const StatusBadgeContent = ({ outcome, label, isPartial }: StatusBadgeContentProps) => {
  const OutcomeIcon = isPartial ? WarningIcon : getOutcomeIcon(outcome);

  return (
    <>
      <Icon as={OutcomeIcon} boxSize={3} mr={1} />
      {label}
    </>
  );
};
