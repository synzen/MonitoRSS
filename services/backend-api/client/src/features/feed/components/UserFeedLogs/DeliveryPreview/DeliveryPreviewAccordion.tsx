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
import { ArticleDeliveryResult, ArticleDeliveryOutcome } from "../../../types/DeliveryPreview";
import { ArticleDeliveryDetails } from "./ArticleDeliveryDetails";
import { getOutcomeLabel, getOutcomeColorScheme, StatusBadgeContent } from "./deliveryPreviewUtils";
import {
  ARTICLE_LIST_CONTAINER_PROPS,
  ARTICLE_LIST_ITEM_PADDING,
  getArticleListItemBorderProps,
} from "./deliveryPreviewStyles";

const getStatusBorderColor = (outcome: ArticleDeliveryOutcome): string => {
  switch (outcome) {
    case ArticleDeliveryOutcome.WouldDeliver:
    case ArticleDeliveryOutcome.WouldDeliverPassingComparison:
      return "green.400";
    case ArticleDeliveryOutcome.FirstRunBaseline:
      return "blue.400";
    case ArticleDeliveryOutcome.DuplicateId:
    case ArticleDeliveryOutcome.BlockedByComparison:
    case ArticleDeliveryOutcome.FeedUnchanged:
      return "gray.500";
    case ArticleDeliveryOutcome.FilteredByDateCheck:
    case ArticleDeliveryOutcome.FilteredByMediumFilter:
      return "orange.400";
    case ArticleDeliveryOutcome.RateLimitedFeed:
    case ArticleDeliveryOutcome.RateLimitedMedium:
    case ArticleDeliveryOutcome.MixedResults:
      return "yellow.400";
    case ArticleDeliveryOutcome.FeedError:
      return "red.400";
    default:
      return "gray.500";
  }
};

interface DeliveryPreviewAccordionItemProps {
  result: ArticleDeliveryResult;
  isFirst: boolean;
  lastRequestAtUnix?: number;
}

const DeliveryPreviewAccordionItem = ({
  result,
  isFirst,
  lastRequestAtUnix,
}: DeliveryPreviewAccordionItemProps) => {
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
        <ArticleDeliveryDetails result={result} lastRequestAtUnix={lastRequestAtUnix} />
      </AccordionPanel>
    </AccordionItem>
  );
};

interface DeliveryPreviewAccordionProps {
  results: ArticleDeliveryResult[];
  lastRequestAtUnix?: number;
}

export const DeliveryPreviewAccordion = ({
  results,
  lastRequestAtUnix,
}: DeliveryPreviewAccordionProps) => (
  <Box {...ARTICLE_LIST_CONTAINER_PROPS}>
    <Accordion allowMultiple>
      {results.map((result, index) => (
        <DeliveryPreviewAccordionItem
          key={result.articleId}
          result={result}
          isFirst={index === 0}
          lastRequestAtUnix={lastRequestAtUnix}
        />
      ))}
    </Accordion>
  </Box>
);

export const DeliveryPreviewAccordionSkeleton = ({ count = 10 }: { count?: number }) => (
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
