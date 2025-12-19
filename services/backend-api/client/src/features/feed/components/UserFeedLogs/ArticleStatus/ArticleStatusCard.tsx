import { Badge, Box, Collapse, HStack, Stack, Text, useDisclosure } from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";
import { ArticleDiagnosticResult } from "../../../types/ArticleDiagnostics";
import { ArticleDiagnosticDetails } from "./ArticleDiagnosticDetails";
import { getOutcomeLabel, getOutcomeColorScheme, StatusBadgeContent } from "./statusUtils";

interface Props {
  result: ArticleDiagnosticResult;
}

export const ArticleStatusCard = ({ result }: Props) => {
  const { isOpen, onToggle } = useDisclosure();

  const displayOutcome = getOutcomeLabel(result.outcome);
  const colorScheme = getOutcomeColorScheme(result.outcome);

  return (
    <Box border="1px solid" borderColor="gray.700" borderRadius="md" overflow="hidden">
      <Box
        px={4}
        py={3}
        cursor="pointer"
        onClick={onToggle}
        _hover={{ bg: "whiteAlpha.50" }}
        role="button"
        aria-expanded={isOpen}
        minHeight="44px"
      >
        <Stack spacing={2}>
          <HStack spacing={2}>
            <Box
              color="gray.500"
              flexShrink={0}
              transform={isOpen ? "rotate(90deg)" : "rotate(0deg)"}
              transition="transform 150ms ease-out"
            >
              <ChevronRightIcon boxSize={4} />
            </Box>
            <Text
              fontSize="sm"
              fontWeight="medium"
              noOfLines={2}
              title={result.articleTitle || "Untitled"}
              flex={1}
            >
              {result.articleTitle || (
                <Text as="span" color="whiteAlpha.600" fontStyle="italic">
                  (no title)
                </Text>
              )}
            </Text>
          </HStack>
          <HStack spacing={2} pl={6}>
            <Text fontSize="xs" color="whiteAlpha.600">
              Status:
            </Text>
            <Badge colorScheme={colorScheme} fontSize="xs">
              <StatusBadgeContent outcome={result.outcome} label={displayOutcome} />
            </Badge>
          </HStack>
        </Stack>
      </Box>
      <Collapse in={isOpen} animateOpacity>
        <ArticleDiagnosticDetails result={result} />
      </Collapse>
    </Box>
  );
};
