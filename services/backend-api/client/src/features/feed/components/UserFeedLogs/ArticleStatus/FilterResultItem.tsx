import { Box, Flex, Highlight, Stack, Text } from "@chakra-ui/react";
import { RelationalExpressionOperator } from "../../../../feedConnections/types";
import { FilterExplainBlockedDetail } from "../../../types/ArticleDiagnostics";

interface FilterResultItemProps {
  detail: FilterExplainBlockedDetail;
  matched?: boolean;
}

const getOperatorText = (operator: string, matched: boolean): string => {
  // When matched OR blocked by negation, use positive framing
  // When blocked (not matched, not negated), use negative framing
  if (matched) {
    switch (operator) {
      case RelationalExpressionOperator.Contains:
        return "contains";
      case RelationalExpressionOperator.Equals:
        return "equals";
      case RelationalExpressionOperator.Matches:
        return "matches regex";
      default:
        return "matches";
    }
  }

  switch (operator) {
    case RelationalExpressionOperator.Contains:
      return "does not contain";
    case RelationalExpressionOperator.Equals:
      return "does not equal";
    case RelationalExpressionOperator.Matches:
      return "does not match regex";
    default:
      return "does not match";
  }
};

export const FilterResultItem = ({ detail, matched = false }: FilterResultItemProps) => {
  const { fieldName, operator, isNegated, truncatedReferenceValue, filterInput } = detail;

  const operatorText = getOperatorText(operator, matched);

  let headline: string;

  if (matched) {
    headline = `${fieldName} ${operatorText} "${filterInput}"`;
  } else if (isNegated) {
    headline = `${fieldName} ${operatorText} "${filterInput}" (blocked by NOT filter)`;
  } else {
    headline = `${fieldName} ${operatorText} "${filterInput}"`;
  }

  let filterLabel: string;

  if (matched) {
    filterLabel = "Matched term";
  } else if (isNegated) {
    filterLabel = "Excluded term";
  } else {
    filterLabel = "Looking for";
  }

  const borderColor = matched ? "green.400" : "whiteAlpha.300";
  const highlightBg = matched ? "green.300" : "orange.300";

  return (
    <Box pl={4} py={2} borderLeft="2px solid" borderLeftColor={borderColor}>
      <Text fontWeight="medium" fontSize="sm" mb={2}>
        {headline}
      </Text>
      <Stack spacing={1} fontSize="sm">
        <Flex>
          <Text color="gray.400" minW="110px">
            Actual value
          </Text>
          <Text fontFamily="mono" wordBreak="break-word">
            {truncatedReferenceValue ? (
              <Highlight query={filterInput} styles={{ bg: highlightBg, px: "1", rounded: "sm" }}>
                {truncatedReferenceValue}
              </Highlight>
            ) : (
              "(empty)"
            )}
          </Text>
        </Flex>
        <Flex>
          <Text color="gray.400" minW="110px">
            {filterLabel}
          </Text>
          <Text fontFamily="mono">{filterInput}</Text>
        </Flex>
      </Stack>
    </Box>
  );
};
