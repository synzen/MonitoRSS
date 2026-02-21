import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { ExternalContentError, ExternalContentErrorType } from "../../../feed/types";
import {
  categorizeErrors,
  formatLabelList,
  getAffectedLabels,
  getAlertSeverity,
  getErrorGuidance,
  getErrorTypeLabel,
} from "../../utils/externalContentErrors";
import { HtmlViewerModal } from "./HtmlViewerModal";

interface Props {
  errors: ExternalContentError[];
}

const ErrorItem = ({ error }: { error: ExternalContentError }) => {
  const errorType = error.errorType as ExternalContentErrorType;

  return (
    <Box p={3} bg="gray.700" rounded="md">
      <HStack spacing={2} mb={2} flexWrap="wrap">
        <Text fontSize="sm" fontWeight="medium">
          &quot;{error.label}&quot;
        </Text>
        {error.statusCode && (
          <Badge colorScheme="orange" fontSize="xs">
            HTTP {error.statusCode}
          </Badge>
        )}
        {errorType === ExternalContentErrorType.INVALID_CSS_SELECTOR && (
          <Badge colorScheme="red" fontSize="xs">
            {getErrorTypeLabel(errorType)}
          </Badge>
        )}
        {errorType === ExternalContentErrorType.NO_SELECTOR_MATCH && (
          <Badge colorScheme="yellow" fontSize="xs">
            {getErrorTypeLabel(errorType)}
          </Badge>
        )}
      </HStack>
      {error.message && (
        <Text color="red.300" fontSize="xs" mt={1}>
          {error.message}
        </Text>
      )}
      <Text fontSize="xs" color="gray.300" mt={2}>
        {getErrorGuidance(errorType, error.statusCode)}
      </Text>
      {errorType === ExternalContentErrorType.NO_SELECTOR_MATCH && error.pageHtml && (
        <HtmlViewerModal
          trigger={
            <Button size="xs" variant="outline" mt={2}>
              View Page Source
            </Button>
          }
          html={error.pageHtml}
          isTruncated={error.pageHtmlTruncated}
          cssSelector={error.cssSelector}
        />
      )}
    </Box>
  );
};

const ErrorCategory = ({ title, errors }: { title: string; errors: ExternalContentError[] }) => {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Text fontSize="sm" fontWeight="medium" color="gray.300">
        {title}
      </Text>
      {errors.map((error) => (
        <ErrorItem
          key={`${error.articleId}-${error.label}-${error.cssSelector}-${error.errorType}`}
          error={error}
        />
      ))}
    </Stack>
  );
};

const buildSummary = (
  configErrors: ExternalContentError[],
  selectorWarnings: ExternalContentError[],
  externalErrors: ExternalContentError[],
): { title: string; description: string } => {
  const hasConfigErrors = configErrors.length > 0;
  const hasSelectorWarnings = selectorWarnings.length > 0;
  const hasExternalErrors = externalErrors.length > 0;

  // Multiple issue types
  if (
    (hasConfigErrors && hasSelectorWarnings) ||
    (hasConfigErrors && hasExternalErrors) ||
    (hasSelectorWarnings && hasExternalErrors)
  ) {
    const parts: string[] = [];

    if (hasConfigErrors) {
      parts.push(`${configErrors.length} invalid selector${configErrors.length > 1 ? "s" : ""}`);
    }

    if (hasSelectorWarnings) {
      parts.push(
        `${selectorWarnings.length} selector${
          selectorWarnings.length > 1 ? "s" : ""
        } with no matches`,
      );
    }

    if (hasExternalErrors) {
      parts.push(
        `${externalErrors.length} page load failure${externalErrors.length > 1 ? "s" : ""}`,
      );
    }

    return {
      title: "External content issues found",
      description: parts.join(" | "),
    };
  }

  // Only config errors
  if (hasConfigErrors) {
    const labels = getAffectedLabels(configErrors);
    const labelText = formatLabelList(labels);

    if (configErrors.length === 1) {
      return {
        title: "External property has invalid selector",
        description: `${labelText} has an invalid CSS selector`,
      };
    }

    return {
      title: `${configErrors.length} external properties have invalid selectors`,
      description: `Affected: ${labelText}`,
    };
  }

  // Only selector warnings
  if (hasSelectorWarnings) {
    const labels = getAffectedLabels(selectorWarnings);
    const labelText = formatLabelList(labels);

    if (selectorWarnings.length === 1) {
      return {
        title: "CSS selector found no matches",
        description: `${labelText} matched no elements on the page`,
      };
    }

    return {
      title: `${selectorWarnings.length} selectors found no matches`,
      description: `Affected: ${labelText}`,
    };
  }

  // Only external errors
  const labels = getAffectedLabels(externalErrors);
  const labelText = formatLabelList(labels);
  const count = externalErrors.length;

  return {
    title: "Some external content couldn't be loaded",
    description: `${count} page${count > 1 ? "s" : ""} returned errors - Affected: ${labelText}`,
  };
};

export const ExternalContentErrorsAlert = ({ errors }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { configErrors, selectorWarnings, externalErrors } = categorizeErrors(errors);
  const alertStatus = getAlertSeverity(errors);
  const { title, description } = buildSummary(configErrors, selectorWarnings, externalErrors);

  if (errors.length === 0) {
    return null;
  }

  const showDividerAfterConfig =
    configErrors.length > 0 && (selectorWarnings.length > 0 || externalErrors.length > 0);
  const showDividerAfterSelector = selectorWarnings.length > 0 && externalErrors.length > 0;

  return (
    <Stack spacing={3}>
      <Alert status={alertStatus} borderRadius="md">
        <AlertIcon />
        <Box flex="1">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription fontSize="sm">{description}</AlertDescription>
        </Box>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Hide details" : "Show details"}
        </Button>
      </Alert>
      {isExpanded && (
        <Box border="solid 1px" borderColor="gray.600" rounded="md" p={4} bg="gray.800">
          <Stack spacing={4}>
            <ErrorCategory title="Configuration Errors (fix required)" errors={configErrors} />
            {showDividerAfterConfig && <Divider borderColor="gray.600" />}
            <ErrorCategory
              title="Selector Issues (may need adjustment)"
              errors={selectorWarnings}
            />
            {showDividerAfterSelector && <Divider borderColor="gray.600" />}
            <ErrorCategory title="Page Load Failures (may be temporary)" errors={externalErrors} />
          </Stack>
        </Box>
      )}
    </Stack>
  );
};
