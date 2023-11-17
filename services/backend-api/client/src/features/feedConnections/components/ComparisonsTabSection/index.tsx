import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Button,
  Flex,
  Heading,
  HStack,
  Spinner,
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
import { getErrorMessageForArticleRequestStatus } from "../../../feed/utils";
import { UserFeedArticleRequestStatus } from "../../../feed/types";

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
    try {
      await onUpdate({
        passingComparisons: [...(passingComparisons || []), value],
        blockingComparisons,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const onAddBlockingComparison = async (value: string) => {
    try {
      await onUpdate({
        passingComparisons,
        blockingComparisons: [...(blockingComparisons || []), value],
      });
    } catch (err) {
      console.error(err);
    }
  };

  const onRemovePassingComparison = async (value: string) => {
    try {
      await onUpdate({
        passingComparisons: passingComparisons?.filter((comparison) => comparison !== value),
        blockingComparisons,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const onRemoveBlockingComparison = async (value: string) => {
    try {
      await onUpdate({
        passingComparisons,
        blockingComparisons: blockingComparisons?.filter((comparison) => comparison !== value),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const requestStatus = userFeedArticles?.result.requestStatus;

  const alertStatus =
    requestStatus && requestStatus !== UserFeedArticleRequestStatus.Success
      ? getErrorMessageForArticleRequestStatus(
          requestStatus,
          userFeedArticles?.result?.response?.statusCode
        )
      : null;

  const parseErrorAlert = alertStatus && (
    <Alert status={alertStatus.status || "error"}>
      <AlertIcon />
      {t(alertStatus.ref)}
    </Alert>
  );
  const fetchErrorAlert = userFeedArticlesStatus === "error" && (
    <Alert status="error">
      <AlertIcon />
      {t("common.errors.somethingWentWrong")}
    </Alert>
  );

  const noArticlesAlert = userFeedArticles?.result.articles.length === 0 && (
    <Alert status="info">
      <AlertIcon />
      {t("features.feedConnections.components.articlePlaceholderTable.noArticles")}
    </Alert>
  );

  const hasAlert = !!(fetchErrorAlert || parseErrorAlert || noArticlesAlert);

  return (
    <Stack spacing={16} marginBottom={16}>
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
      <Stack background="gray.700" padding={4} borderRadius="md">
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
        {fetchErrorAlert || parseErrorAlert || noArticlesAlert}
        {userFeedArticlesStatus === "loading" && (
          <Stack borderRadius="lg" background="gray.800" padding={4} alignItems="center">
            <Spinner size="md" />
            <Text>Loading article...</Text>
          </Stack>
        )}
        {!hasAlert && userFeedArticles?.result.articles.length && (
          <Stack
            maxHeight={400}
            overflow="auto"
            borderRadius="lg"
            background="gray.800"
            padding={4}
          >
            <ArticlePlaceholderTable
              article={userFeedArticles?.result.articles[0]}
              searchText=""
              isFetching={userFeedArticlesFetchStatus === "fetching"}
              withoutCopy
            />
          </Stack>
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
