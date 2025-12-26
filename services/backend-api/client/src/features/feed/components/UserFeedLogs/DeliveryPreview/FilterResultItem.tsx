import { Box, Highlight, Text } from "@chakra-ui/react";
import { RelationalExpressionOperator } from "../../../../feedConnections/types";
import { FilterExplainBlockedDetail } from "../../../types/DeliveryPreview";

interface FilterResultItemProps {
  detail: FilterExplainBlockedDetail;
  matched?: boolean;
}

const getReadableOperator = (operator: string): string => {
  switch (operator) {
    case RelationalExpressionOperator.Contains:
      return "contain";
    case RelationalExpressionOperator.Equals:
      return "equal";
    case RelationalExpressionOperator.Matches:
      return "regex match";
    default:
      return "match";
  }
};

const getProseExplanation = (
  fieldName: string,
  operator: string,
  filterInput: string,
  isNegated: boolean,
  matched: boolean
): string => {
  const fieldLabel = fieldName.toLowerCase();
  const readableOp = getReadableOperator(operator);

  // When matched: describe what the filter rule is (what passed)
  // When blocked: describe what the article actually did (opposite of what filter wanted)
  const articleMatchedCondition = matched ? !isNegated : isNegated;
  const doesOrDoesNot = articleMatchedCondition ? "does" : "does not";

  return `The ${fieldLabel} ${doesOrDoesNot} ${readableOp} "${filterInput}".`;
};

export const FilterResultItem = ({ detail, matched = false }: FilterResultItemProps) => {
  const { fieldName, operator, isNegated, truncatedReferenceValue, filterInput } = detail;

  const explanation = getProseExplanation(fieldName, operator, filterInput, isNegated, matched);
  const borderColor = matched ? "green.600" : "orange.600";
  const highlightBg = matched ? "green.700" : "orange.700";

  return (
    <Box
      py={3}
      px={4}
      bg="whiteAlpha.50"
      borderLeft="3px solid"
      borderLeftColor={borderColor}
      borderRadius="md"
    >
      <Text fontSize="sm" mb={3}>
        {explanation}
      </Text>
      <Box bg="blackAlpha.300" p={2} borderRadius="sm">
        <Text fontSize="xs" color="gray.400" mb={1}>
          {fieldName}:
        </Text>
        <Text fontFamily="mono" fontSize="sm" wordBreak="break-word">
          {truncatedReferenceValue ? (
            <Highlight query={filterInput} styles={{ bg: highlightBg, px: "1", rounded: "sm" }}>
              {truncatedReferenceValue}
            </Highlight>
          ) : (
            <Text as="span" color="gray.500">
              (empty)
            </Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};
