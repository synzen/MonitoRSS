import { Alert, Flex, Heading, HStack, Separator, Spinner, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { FiMousePointer } from "react-icons/fi";
import {
  useUserFeedArticleProperties,
  useUserFeedArticles,
  ArticleSelectDialog,
  getErrorMessageForArticleRequestStatus,
  UserFeedArticleRequestStatus,
  useUserFeedContext,
} from "@/features/feed";
import { AddComparisonSelect } from "./AddComparisonSelect";
import { ComparisonTag } from "./ComparisonTag";
import { ArticlePlaceholderTable } from "../ArticlePlaceholderTable";
import { InlineErrorAlert } from "@/components";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { usePageAlertContext } from "@/contexts/PageAlertContext";

interface Props {
  passingComparisons?: string[];
  blockingComparisons?: string[];
  onUpdate: (data: {
    passingComparisons?: string[];
    blockingComparisons?: string[];
  }) => Promise<void>;
  updateError?: string;
}

export const ComparisonsTabSection = ({
  blockingComparisons,
  passingComparisons,
  onUpdate,
  updateError,
}: Props) => {
  const { t } = useTranslation();
  const {
    userFeed: { id: feedId },
    articleFormatOptions,
  } = useUserFeedContext();
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
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
      formatOptions: articleFormatOptions,
      filters: {
        articleId: selectedArticleId,
      },
    },
  });
  const [errorLocation, setErrorLocation] = useState<"passing" | "blocking" | "">("");
  const { createErrorAlert } = usePageAlertContext();

  const onClickRandomFeedArticle = async () => {
    try {
      setSelectedArticleId(undefined);
      await refetchUserFeedArticle();
    } catch (err) {
      createErrorAlert({
        title: "Failed to fetch article.",
        description: (err as Error).message,
      });
    }
  };

  const { data, error, status, fetchStatus } = useUserFeedArticleProperties({
    feedId,
    data: {
      // Must be empty because this is at the feed level
      customPlaceholders: [],
    },
  });

  const onSelectedArticle = async (articleId: string) => {
    setSelectedArticleId(articleId);
  };

  const passingComaprisonsToAdd = data?.result.properties.filter(
    (property) => !passingComparisons?.includes(property),
  );

  const blockingComparisonsToAdd = data?.result.properties.filter(
    (property) => !blockingComparisons?.includes(property),
  );

  const onAddPassingComparison = async (value: string) => {
    try {
      await onUpdate({
        passingComparisons: [...(passingComparisons || []), value],
        blockingComparisons,
      });
      setErrorLocation("");
    } catch (err) {
      setErrorLocation("passing");
    }
  };

  const onAddBlockingComparison = async (value: string) => {
    try {
      await onUpdate({
        passingComparisons,
        blockingComparisons: [...(blockingComparisons || []), value],
      });
      setErrorLocation("");
    } catch (err) {
      setErrorLocation("blocking");
    }
  };

  const onRemovePassingComparison = async (value: string) => {
    try {
      await onUpdate({
        passingComparisons: passingComparisons?.filter((comparison) => comparison !== value),
        blockingComparisons,
      });
      setErrorLocation("");
    } catch (err) {
      setErrorLocation("passing");
    }
  };

  const onRemoveBlockingComparison = async (value: string) => {
    try {
      await onUpdate({
        passingComparisons,
        blockingComparisons: blockingComparisons?.filter((comparison) => comparison !== value),
      });
      setErrorLocation("");
    } catch (err) {
      setErrorLocation("blocking");
    }
  };

  const requestStatus = userFeedArticles?.result.requestStatus;

  const alertStatus =
    requestStatus && requestStatus !== UserFeedArticleRequestStatus.Success
      ? getErrorMessageForArticleRequestStatus(
          requestStatus,
          userFeedArticles?.result?.response?.statusCode,
        )
      : null;

  const parseErrorAlert = alertStatus && (
    <Alert.Root status={alertStatus.status || "error"}>{t(alertStatus.ref)}</Alert.Root>
  );
  const fetchErrorAlert = userFeedArticlesStatus === "error" && (
    <Alert.Root status="error">{t("common.errors.somethingWentWrong")}</Alert.Root>
  );

  const noArticlesAlert = userFeedArticles?.result.articles.length === 0 && (
    <Alert.Root status="info">
      {t("features.feedConnections.components.articlePlaceholderTable.noArticles")}
    </Alert.Root>
  );

  const hasAlert = !!(fetchErrorAlert || parseErrorAlert || noArticlesAlert);

  return (
    <Stack gap={12} marginBottom={16}>
      {error && (
        <Stack gap={4}>
          <Alert.Root status="error">
            <Alert.Title>
              {t(
                "features.feedConnections.components.comparisonsTabSection.errorFailedToGetPropertiesTitle",
              )}
            </Alert.Title>
            <Alert.Description>{error.message}</Alert.Description>
          </Alert.Root>
        </Stack>
      )}
      <Stack>
        <Heading size="md" as="h2">
          Comparisons
        </Heading>
        <Text>
          If you are either not receiving articles or getting duplicate articles, you can add
          additional properties that can be used to determine if an article should or should not get
          delivered.
        </Text>
      </Stack>
      <Stack gap={8}>
        <Stack gap={4} border="1px solid" borderColor="border" borderRadius="l3" padding={4}>
          <Stack>
            <Heading size="sm" as="h3">
              {t(
                "features.feedConnections.components.comparisonsTabSection.passingComparisonsTitle",
              )}
            </Heading>
            <Text>
              {t(
                "features.feedConnections.components.comparisonsTabSection.passingComparisonsDescription",
              )}
            </Text>
          </Stack>
          <Stack>
            <Heading srOnly as="h4" id="passing-comparisons">
              Current passing comparisons
            </Heading>
            {!passingComparisons?.length && (
              <Text color="fg.muted">You currently have no passing comparisons created.</Text>
            )}
            {!!passingComparisons?.length && (
              <HStack
                flexWrap="wrap"
                alignItems="center"
                as="ul"
                aria-labelledby="passing-comparisons"
              >
                {passingComparisons.map((comparison) => (
                  <ComparisonTag
                    title={comparison}
                    colorScheme="cyan"
                    onDelete={() => onRemovePassingComparison(comparison)}
                    deleteButtonAriaLabel={`Delete passing comparison ${comparison}`}
                  />
                ))}
              </HStack>
            )}
            <Separator my={2} />
            <AddComparisonSelect
              isDisabled={status !== "success"}
              isLoading={status === "loading" || fetchStatus === "fetching"}
              onChange={onAddPassingComparison}
              properties={passingComaprisonsToAdd}
              formLabel="Add a new passing comparison"
            />
          </Stack>
          {updateError && errorLocation === "passing" && (
            <InlineErrorAlert title={t("common.errors.failedToSave")} description={updateError} />
          )}
        </Stack>
        <Stack gap={4} border="1px solid" borderColor="border" borderRadius="l3" padding={4}>
          <Stack>
            <Heading size="sm" as="h3">
              {t(
                "features.feedConnections.components.comparisonsTabSection.blockingComparisonsTitle",
              )}
            </Heading>
            <Text>
              {t(
                "features.feedConnections.components.comparisonsTabSection.blockingComparisonsDescription",
              )}
            </Text>
          </Stack>
          <Stack>
            <Heading srOnly as="h4" id="blocking-comparisons">
              Current blocking comparisons
            </Heading>
            {!blockingComparisons?.length && (
              <Text color="fg.muted">You currently have no blocking comparisons created.</Text>
            )}
            {!!blockingComparisons?.length && (
              <HStack
                flexWrap="wrap"
                alignItems="center"
                as="ul"
                aria-labelledby="blocking-comparisons"
              >
                {blockingComparisons?.map((comparison) => (
                  <ComparisonTag
                    title={comparison}
                    colorScheme="red"
                    onDelete={() => onRemoveBlockingComparison(comparison)}
                    deleteButtonAriaLabel={`Delete blocking comparison ${comparison}`}
                  />
                ))}
              </HStack>
            )}
            <Separator my={2} />
            <AddComparisonSelect
              isDisabled={status !== "success"}
              isLoading={status === "loading" || fetchStatus === "fetching"}
              onChange={onAddBlockingComparison}
              properties={blockingComparisonsToAdd}
              formLabel="Add a new blocking comparison"
            />
          </Stack>
          {updateError && errorLocation === "blocking" && (
            <InlineErrorAlert title={t("common.errors.failedToSave")} description={updateError} />
          )}
        </Stack>
        <Stack
          bg="bg.subtle"
          padding={4}
          borderRadius="l3"
          as="aside"
          aria-labelledby="preview-article-props"
        >
          <Flex justifyContent="space-between" flexWrap="wrap">
            <Stack mb={1}>
              <Heading size="sm" as="h3" id="preview-article-props">
                Preview Sample Article Properties
              </Heading>
              <Text>
                Preview an article to see the properties that can be used for comparisons.
              </Text>
            </Stack>
            <ArticleSelectDialog
              trigger={
                <SafeLoadingButton
                  loading={!!selectedArticleId && userFeedArticlesFetchStatus === "fetching"}
                  aria-disabled={userFeedArticlesFetchStatus === "fetching"}
                  size="sm"
                >
                  <FiMousePointer />
                  <span>Select article to preview</span>
                </SafeLoadingButton>
              }
              feedId={feedId}
              onArticleSelected={onSelectedArticle}
              onClickRandomArticle={onClickRandomFeedArticle}
              articleFormatOptions={articleFormatOptions}
            />
          </Flex>
          {fetchErrorAlert || parseErrorAlert || noArticlesAlert}
          {userFeedArticlesStatus === "loading" && (
            <Stack borderRadius="lg" bg="bg.panel" padding={4} alignItems="center">
              <Spinner size="md" />
              <Text>Loading article...</Text>
            </Stack>
          )}
          {!hasAlert && userFeedArticles?.result.articles.length && (
            <Stack maxHeight={400} overflow="auto" borderRadius="lg" bg="bg.panel" padding={4}>
              <ArticlePlaceholderTable
                article={userFeedArticles?.result.articles[0]}
                searchText=""
                isFetching={userFeedArticlesFetchStatus === "fetching"}
                withoutCopy
              />
            </Stack>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
};
