import { Accordion, Badge, Box, HStack, Skeleton, Text } from "@chakra-ui/react";
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
      return "border.emphasized";
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
      return "border.emphasized";
  }
};

interface DeliveryPreviewAccordionItemProps {
  result: ArticleDeliveryResult;
  isFirst: boolean;
  nextRetryAtIso?: string | null;
  nextRetryReason?: "REFRESH_RATE" | "HOST_CACHE" | "FAILED_RETRY_BACKOFF" | null;
  cacheDurationMs?: number | null;
}

const DeliveryPreviewAccordionItem = ({
  result,
  isFirst,
  nextRetryAtIso,
  nextRetryReason,
  cacheDurationMs,
}: DeliveryPreviewAccordionItemProps) => {
  const displayOutcome = getOutcomeLabel(result.outcome);
  const colorPalette = getOutcomeColorScheme(result.outcome);
  const borderColor = getStatusBorderColor(result.outcome);

  return (
    <Accordion.Item
      value={result.articleId}
      border="none"
      {...getArticleListItemBorderProps(isFirst, borderColor)}
    >
      <Accordion.ItemTrigger
        {...ARTICLE_LIST_ITEM_PADDING}
        _hover={{ bg: "bg.emphasized" }}
        _open={{ bg: "bg.emphasized" }}
      >
        <HStack flex="1" gap={2} align="center">
          <Badge colorPalette={colorPalette} fontSize="xs" flexShrink={0}>
            <StatusBadgeContent outcome={result.outcome} label={displayOutcome} />
          </Badge>
          <Text
            fontSize="sm"
            lineClamp={1}
            textAlign="left"
            title={result.articleTitle || "Untitled"}
          >
            {result.articleTitle || (
              <Text as="span" color="fg.muted" fontStyle="italic">
                (no title)
              </Text>
            )}
          </Text>
        </HStack>
        <Accordion.ItemIndicator ml={2} />
      </Accordion.ItemTrigger>
      <Accordion.ItemContent>
        <Accordion.ItemBody p={0}>
          <ArticleDeliveryDetails
            result={result}
            nextRetryAtIso={nextRetryAtIso}
            nextRetryReason={nextRetryReason}
            cacheDurationMs={cacheDurationMs}
          />
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  );
};

interface DeliveryPreviewAccordionProps {
  results: ArticleDeliveryResult[];
  nextRetryAtIso?: string | null;
  nextRetryReason?: "REFRESH_RATE" | "HOST_CACHE" | "FAILED_RETRY_BACKOFF" | null;
  cacheDurationMs?: number | null;
}

export const DeliveryPreviewAccordion = ({
  results,
  nextRetryAtIso,
  nextRetryReason,
  cacheDurationMs,
}: DeliveryPreviewAccordionProps) => (
  <Box {...ARTICLE_LIST_CONTAINER_PROPS}>
    <Accordion.Root multiple>
      {results.map((result, index) => (
        <DeliveryPreviewAccordionItem
          key={result.articleId}
          result={result}
          isFirst={index === 0}
          nextRetryAtIso={nextRetryAtIso}
          nextRetryReason={nextRetryReason}
          cacheDurationMs={cacheDurationMs}
        />
      ))}
    </Accordion.Root>
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
