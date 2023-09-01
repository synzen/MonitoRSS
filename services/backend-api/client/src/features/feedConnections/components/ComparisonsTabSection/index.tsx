import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { FiMousePointer } from "react-icons/fi";
import {
  useUserFeed,
  useUserFeedArticleProperties,
  useUserFeedArticles,
} from "../../../feed/hooks";
import { AddComparisonSelect } from "./AddComparisonSelect";
import { ComparisonTag } from "./ComparisonTag";
import { ArticleSelectDialog } from "../../../feed/components";
import { notifyError } from "../../../../utils/notifyError";
import { ArticlePlaceholderTable } from "../ArticlePlaceholderTable";

interface Props {
  feedId: string;
  passingComparisons?: string[];
  blockingComparisons?: string[];
  onUpdate: (data: {
    passingComparisons?: string[];
    blockingComparisons?: string[];
  }) => Promise<void>;
}

export const ComparisonsTabSection = ({
  feedId,
  blockingComparisons,
  passingComparisons,
  onUpdate,
}: Props) => {
  const { t } = useTranslation();
  const { feed } = useUserFeed({ feedId });
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
  const formatOptions = {
    dateFormat: feed?.formatOptions?.dateFormat,
    dateTimezone: feed?.formatOptions?.dateTimezone,
    formatTables: false,
    stripImages: false,
    disableImageLinkPreviews: false,
  };
  const {
    data: userFeedArticles,
    refetch: refetchUserFeedArticle,
    fetchStatus: userFeedArticlesFetchStatus,
    status: userFeedArticlesStatus,
  } = useUserFeedArticles({
    feedId,
    data: {
      limit: 1,
      random: true,
      skip: 0,
      selectProperties: ["*"],
      formatter: {
        options: formatOptions,
      },
      filters: {
        articleId: selectedArticleId,
      },
    },
  });

  const onClickRandomFeedArticle = async () => {
    try {
      setSelectedArticleId(undefined);
      await refetchUserFeedArticle();
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const { data, error, status, fetchStatus } = useUserFeedArticleProperties({
    feedId,
  });

  const onSelectedArticle = async (articleId: string) => {
    setSelectedArticleId(articleId);
  };

  const passingComaprisonsToAdd = data?.result.properties.filter(
    (property) => !passingComparisons?.includes(property)
  );

  const blockingComparisonsToAdd = data?.result.properties.filter(
    (property) => !blockingComparisons?.includes(property)
  );

  const onAddPassingComparison = async (value: string) => {
    await onUpdate({
      passingComparisons: [...(passingComparisons || []), value],
      blockingComparisons,
    });
  };

  const onAddBlockingComparison = async (value: string) => {
    await onUpdate({
      passingComparisons,
      blockingComparisons: [...(blockingComparisons || []), value],
    });
  };

  const onRemovePassingComparison = async (value: string) => {
    await onUpdate({
      passingComparisons: passingComparisons?.filter((comparison) => comparison !== value),
      blockingComparisons,
    });
  };

  const onRemoveBlockingComparison = async (value: string) => {
    await onUpdate({
      passingComparisons,
      blockingComparisons: blockingComparisons?.filter((comparison) => comparison !== value),
    });
  };

  return (
    <Stack spacing={16} marginBottom={8}>
      {error && (
        <Stack spacing={4}>
          <Alert status="error">
            <AlertIcon />
            <AlertTitle>
              {t(
                "features.feedConnections.components.comparisonsTabSection.errorFailedToGetPropertiesTitle"
              )}
            </AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </Stack>
      )}
      <Stack>
        <Flex justifyContent="space-between">
          <Heading size="sm" as="h3">
            Sample Article Properties
          </Heading>
          <ArticleSelectDialog
            trigger={
              <Button
                leftIcon={<FiMousePointer />}
                isLoading={!!selectedArticleId && userFeedArticlesFetchStatus === "fetching"}
                isDisabled={userFeedArticlesFetchStatus === "fetching"}
              >
                {t("features.feedConnections.components.articlePlaceholderTable.selectArticle")}
              </Button>
            }
            feedId={feedId}
            articleFormatter={{
              options: formatOptions,
            }}
            onArticleSelected={onSelectedArticle}
            onClickRandomArticle={onClickRandomFeedArticle}
          />
        </Flex>
        {userFeedArticles && userFeedArticles.result.articles.length && (
          <ArticlePlaceholderTable
            article={userFeedArticles?.result.articles[0]}
            searchText=""
            isFetching={userFeedArticlesFetchStatus === "fetching"}
            withoutCopy
          />
        )}
      </Stack>
      <Stack spacing={4}>
        <Stack>
          <Heading size="md" as="h3">
            {t("features.feedConnections.components.comparisonsTabSection.passingComparisonsTitle")}
          </Heading>
          <Text>
            {t(
              "features.feedConnections.components.comparisonsTabSection.passingComparisonsDescription"
            )}
          </Text>
        </Stack>
        <HStack flexWrap="wrap" alignItems="center">
          {passingComparisons?.map((comparison) => (
            <ComparisonTag
              title={comparison}
              colorScheme="cyan"
              onDelete={() => onRemovePassingComparison(comparison)}
            />
          ))}
          <AddComparisonSelect
            isDisabled={status !== "success"}
            isLoading={status === "loading" || fetchStatus === "fetching"}
            onChange={onAddPassingComparison}
            properties={passingComaprisonsToAdd}
          />
        </HStack>
      </Stack>
      <Stack spacing={4}>
        <Stack>
          <Heading size="md" as="h3">
            {t(
              "features.feedConnections.components.comparisonsTabSection.blockingComparisonsTitle"
            )}
          </Heading>
          <Text>
            {t(
              "features.feedConnections.components.comparisonsTabSection.blockingComparisonsDescription"
            )}
          </Text>
        </Stack>
        <HStack flexWrap="wrap" alignItems="center">
          {blockingComparisons?.map((comparison) => (
            <ComparisonTag
              title={comparison}
              colorScheme="red"
              onDelete={() => onRemoveBlockingComparison(comparison)}
            />
          ))}
          <AddComparisonSelect
            isDisabled={status !== "success"}
            isLoading={status === "loading" || fetchStatus === "fetching"}
            onChange={onAddBlockingComparison}
            properties={blockingComparisonsToAdd}
          />
        </HStack>
      </Stack>
    </Stack>
  );
};
