import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Spinner,
  Stack,
  TableHeadProps,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArticleFilterResultsView } from "./ArticleFilterResultsView";
import {
  useUserFeedArticleProperties,
  useUserFeedArticlesWithPagination,
} from "../../../feed/hooks";
import { GetArticlesFilterReturnType } from "../../../feed/constants";
import { LogicalFilterExpression } from "../../types";
import { useGetUserFeedArticlesError } from "../../hooks";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { ThemedSelect } from "../../../../components";
import { useDebounce } from "../../../../hooks";

interface Props {
  title?: React.ReactNode | undefined;
  feedId?: string;
  filters?: LogicalFilterExpression | null;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
  tableContainer?: {
    theadProps?: TableHeadProps;
  };
}

export const ArticleFilterResults = ({
  title,
  feedId,
  filters,
  tableContainer,
  articleFormatter,
}: Props) => {
  const [selectedArticleProperty, setSelectedArticleProperty] = useState("title");
  const { data: feedArticlePropertiesResult, status: feedArticlePropertiesStatus } =
    useUserFeedArticleProperties({ feedId });

  const debouncedFilters = useDebounce(filters, 500);

  const {
    data: userFeedArticlesResults,
    status: userFeedArticlesStatus,
    error: userFeedArticlesError,
    fetchStatus,
    nextPage,
    prevPage,
    skip,
    limit,
  } = useUserFeedArticlesWithPagination({
    feedId,
    data: {
      selectProperties: [selectedArticleProperty, "id"],
      filters: {
        returnType: GetArticlesFilterReturnType.IncludeEvaluationResults,
        expression: debouncedFilters || undefined,
      },
      formatter: articleFormatter,
    },
  });
  const { t } = useTranslation();
  const { alertComponent } = useGetUserFeedArticlesError({
    getUserFeedArticlesStatus: userFeedArticlesStatus,
    getUserFeedArticlesError: userFeedArticlesError,
    getUserFeedArticlesOutput: userFeedArticlesResults,
  });

  const articles = userFeedArticlesResults?.result.articles;
  const filterResultsByIndex = userFeedArticlesResults?.result.filterStatuses;
  const useArticleProperty =
    selectedArticleProperty || userFeedArticlesResults?.result.selectedProperties[0];
  const totalArticles = userFeedArticlesResults?.result.totalArticles;

  const onFirstPage = skip === 0;
  const onLastPage = !totalArticles || skip + limit >= totalArticles;

  const onChangeFeedArticleProperty = (value: string) => {
    setSelectedArticleProperty(value);
  };

  return (
    <Stack spacing={4}>
      <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={6}>
        {title || (
          <Heading as="h2" size="sm">
            Filter Results Preview
          </Heading>
        )}
        {!alertComponent && (
          <HStack alignItems="center">
            <Text whiteSpace="nowrap">
              {t(
                "features.feedConnections.components" +
                  ".filtersTabSection.displayPropertyDropdownLabel"
              )}
            </Text>
            <Box width={{ md: "250px", lg: "350px" }}>
              <ThemedSelect
                options={
                  feedArticlePropertiesResult?.result.properties.map((property) => ({
                    value: property,
                    label: property,
                    data: property,
                  })) || []
                }
                isDisabled={feedArticlePropertiesStatus === "loading"}
                loading={feedArticlePropertiesStatus === "loading"}
                value={useArticleProperty}
                onChange={onChangeFeedArticleProperty}
              />
            </Box>
          </HStack>
        )}
      </Flex>
      <Box>
        {alertComponent}
        {userFeedArticlesStatus === "loading" && (
          <Stack alignItems="center" mb={4}>
            <Spinner />
            <Text>Loading articles...</Text>
          </Stack>
        )}
        {userFeedArticlesResults && !alertComponent && (
          <Stack>
            <ArticleFilterResultsView
              theadProps={tableContainer?.theadProps}
              isLoading={fetchStatus === "fetching"}
              articles={
                articles?.map((article: Record<string, any>, index) => ({
                  id: article.id,
                  passedFilters: filterResultsByIndex?.[index]?.passed,
                  propertyValue: article?.[useArticleProperty as string] as string,
                })) || []
              }
              displayPropertyName={useArticleProperty as string}
            />
            <Flex justifyContent="space-between">
              {t("common.table.results", {
                start: skip + 1,
                end: skip + limit,
                total: totalArticles,
              })}
              <HStack>
                <Button
                  size="sm"
                  width="min-content"
                  onClick={prevPage}
                  isDisabled={onFirstPage || fetchStatus === "fetching"}
                >
                  {t("features.feedConnections.components.filtersTabSection.prevPage")}
                </Button>
                <Button
                  size="sm"
                  width="min-content"
                  onClick={nextPage}
                  isDisabled={onLastPage || fetchStatus === "fetching"}
                >
                  {t("features.feedConnections.components.filtersTabSection.nextPage")}
                </Button>
              </HStack>
            </Flex>
          </Stack>
        )}
      </Box>
    </Stack>
  );
};
