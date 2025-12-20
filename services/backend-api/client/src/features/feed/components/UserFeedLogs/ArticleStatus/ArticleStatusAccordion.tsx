import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  HStack,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import {
  ArticleDiagnosticResult,
  ArticleDiagnosisOutcome,
} from "../../../types/ArticleDiagnostics";
import { ArticleDiagnosticDetails } from "./ArticleDiagnosticDetails";
import { getOutcomeLabel, getOutcomeColorScheme, StatusBadgeContent } from "./statusUtils";
import {
  ARTICLE_LIST_CONTAINER_PROPS,
  ARTICLE_LIST_ITEM_PADDING,
  getArticleListItemBorderProps,
} from "./articleStatusStyles";

const getStatusBorderColor = (outcome: ArticleDiagnosisOutcome): string => {
  switch (outcome) {
    case ArticleDiagnosisOutcome.WouldDeliver:
    case ArticleDiagnosisOutcome.WouldDeliverPassingComparison:
      return "green.400";
    case ArticleDiagnosisOutcome.FirstRunBaseline:
      return "blue.400";
    case ArticleDiagnosisOutcome.DuplicateId:
    case ArticleDiagnosisOutcome.BlockedByComparison:
    case ArticleDiagnosisOutcome.FeedUnchanged:
      return "gray.500";
    case ArticleDiagnosisOutcome.FilteredByDateCheck:
    case ArticleDiagnosisOutcome.FilteredByMediumFilter:
      return "orange.400";
    case ArticleDiagnosisOutcome.RateLimitedFeed:
    case ArticleDiagnosisOutcome.RateLimitedMedium:
    case ArticleDiagnosisOutcome.MixedResults:
      return "yellow.400";
    case ArticleDiagnosisOutcome.FeedError:
      return "red.400";
    default:
      return "gray.500";
  }
};

interface ArticleStatusAccordionItemProps {
  result: ArticleDiagnosticResult;
  isFirst: boolean;
}

const ArticleStatusAccordionItem = ({ result, isFirst }: ArticleStatusAccordionItemProps) => {
  const displayOutcome = getOutcomeLabel(result.outcome);
  const colorScheme = getOutcomeColorScheme(result.outcome);
  const borderColor = getStatusBorderColor(result.outcome);

  return (
    <AccordionItem border="none" sx={getArticleListItemBorderProps(isFirst, borderColor)}>
      <AccordionButton
        {...ARTICLE_LIST_ITEM_PADDING}
        _hover={{ bg: "whiteAlpha.50" }}
        _expanded={{ bg: "whiteAlpha.50" }}
      >
        <HStack flex="1" spacing={2} align="center">
          <Badge colorScheme={colorScheme} fontSize="xs" flexShrink={0}>
            <StatusBadgeContent outcome={result.outcome} label={displayOutcome} />
          </Badge>
          <Text
            fontSize="sm"
            noOfLines={1}
            textAlign="left"
            title={result.articleTitle || "Untitled"}
          >
            {result.articleTitle || (
              <Text as="span" color="whiteAlpha.600" fontStyle="italic">
                (no title)
              </Text>
            )}
          </Text>
        </HStack>
        <AccordionIcon ml={2} />
      </AccordionButton>
      <AccordionPanel p={0}>
        <ArticleDiagnosticDetails result={result} />
      </AccordionPanel>
    </AccordionItem>
  );
};

interface ArticleStatusAccordionProps {
  results: ArticleDiagnosticResult[];
}

export const ArticleStatusAccordion = ({ results }: ArticleStatusAccordionProps) => (
  <Box {...ARTICLE_LIST_CONTAINER_PROPS}>
    <Accordion allowMultiple>
      {results.map((result, index) => (
        <ArticleStatusAccordionItem key={result.articleId} result={result} isFirst={index === 0} />
      ))}
    </Accordion>
  </Box>
);

export const ArticleStatusAccordionSkeleton = ({ count = 10 }: { count?: number }) => (
  <Box {...ARTICLE_LIST_CONTAINER_PROPS}>
    {[...Array(count)].map((_, i) => (
      <Box
        // eslint-disable-next-line react/no-array-index-key
        key={`skeleton-${i}`}
        {...ARTICLE_LIST_ITEM_PADDING}
        {...getArticleListItemBorderProps(i === 0)}
      >
        <Skeleton height="20px" />
      </Box>
    ))}
  </Box>
);
