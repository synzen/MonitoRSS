import { Badge, Box, Collapse, HStack, Td, Text, Tr, useDisclosure } from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";
import { ArticleDiagnosticResult } from "../../../types/ArticleDiagnostics";
import { ArticleDiagnosticDetails } from "./ArticleDiagnosticDetails";
import { getOutcomeLabel, getOutcomeColorScheme, StatusBadgeContent } from "./statusUtils";

interface Props {
  result: ArticleDiagnosticResult;
}

export const ArticleStatusRow = ({ result }: Props) => {
  const { isOpen, onToggle } = useDisclosure();

  const displayOutcome = getOutcomeLabel(result.outcome);
  const colorScheme = getOutcomeColorScheme(result.outcome);

  return (
    <>
      <Tr
        cursor="pointer"
        onClick={onToggle}
        _hover={{ bg: "whiteAlpha.50" }}
        role="button"
        aria-expanded={isOpen}
      >
        <Td>
          <HStack spacing={2}>
            <Box
              color="gray.500"
              flexShrink={0}
              transform={isOpen ? "rotate(90deg)" : "rotate(0deg)"}
              transition="transform 150ms ease-out"
            >
              <ChevronRightIcon boxSize={4} />
            </Box>
            <Badge colorScheme={colorScheme} fontSize="xs">
              <StatusBadgeContent
                outcome={result.outcome}
                label={displayOutcome}
              />
            </Badge>
          </HStack>
        </Td>
        <Td>
          <Text fontSize="sm" noOfLines={1} title={result.articleTitle || "Untitled"}>
            {result.articleTitle || (
              <Text as="span" color="whiteAlpha.600" fontStyle="italic">
                (no title)
              </Text>
            )}
          </Text>
        </Td>
      </Tr>
      <Tr>
        <Td colSpan={2} p={0}>
          <Collapse in={isOpen} animateOpacity>
            <ArticleDiagnosticDetails result={result} />
          </Collapse>
        </Td>
      </Tr>
    </>
  );
};
