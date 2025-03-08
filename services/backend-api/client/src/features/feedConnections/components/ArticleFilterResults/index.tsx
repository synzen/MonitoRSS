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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArticleFilterResultsView } from "./ArticleFilterResultsView";
import {
  useUserFeedArticleProperties,
  useUserFeedArticlesWithPagination,
} from "../../../feed/hooks";
import { GetArticlesFilterReturnType } from "../../../feed/constants";
import { LogicalFilterExpression } from "../../types";
import { useGetUserFeedArticlesError } from "../../hooks";
import { ThemedSelect } from "../../../../components";
import { useDebounce } from "../../../../hooks";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";
import { FeedDiscordChannelConnection } from "../../../../types";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";

interface Props {
  title?: React.ReactNode | undefined;
  filters?: LogicalFilterExpression | null;
  tableContainer?: {
    theadProps?: TableHeadProps;
  };
}

export const ArticleFilterResults = ({ title, filters, tableContainer }: Props) => {
  const {
    userFeed: { id: feedId },
  } = useUserFeedContext();
  const { articleFormatOptions } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const [selectedArticleProperty, setSelectedArticleProperty] = useState("title");
  const { data: feedArticlePropertiesResult, status: feedArticlePropertiesStatus } =
    useUserFeedArticleProperties({
      feedId,
      data: {
        customPlaceholders: articleFormatOptions.customPlaceholders,
      },
    });

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
      formatOptions: articleFormatOptions,
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

  useEffect(() => {
    if (
      feedArticlePropertiesResult?.result.properties &&
      !feedArticlePropertiesResult.result.properties.includes(selectedArticleProperty)
    ) {
      setSelectedArticleProperty(feedArticlePropertiesResult.result.properties[0]);
    }
  }, [feedArticlePropertiesResult?.result.properties]);

  return (
    <Stack spacing={4}>
      <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={6}>
        {title || (
          <Heading as="h2" size="sm">
            Filter Results Preview
          </Heading>
        )}
        {!alertComponent && (
          <HStack alignItems="center" flexWrap="wrap">
            <Text
              as="label"
              whiteSpace="nowrap"
              id="article-property-select-label"
              htmlFor="article-property-select"
            >
              Display article property:
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
                isInvalid={false}
                selectProps={{
                  inputId: "article-property-select",
                  "aria-labelledby": "article-property-select-label",
                }}
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
            <Flex justifyContent="space-between" flexWrap="wrap" gap={2}>
              {t("common.table.results", {
                start: skip + 1,
                end: skip + limit,
                total: totalArticles,
              })}
              <HStack>
                <Button
                  size="sm"
                  width="min-content"
                  onClick={() => {
                    if (onFirstPage || fetchStatus === "fetching") {
                      return;
                    }

                    prevPage();
                  }}
                  aria-disabled={onFirstPage || fetchStatus === "fetching"}
                >
                  <span>Previous Page</span>
                </Button>
                <Button
                  size="sm"
                  width="min-content"
                  onClick={() => {
                    if (onLastPage || fetchStatus === "fetching") {
                      return;
                    }

                    nextPage();
                  }}
                  aria-disabled={onLastPage || fetchStatus === "fetching"}
                >
                  <span>Next Page</span>
                </Button>
              </HStack>
            </Flex>
          </Stack>
        )}
      </Box>
    </Stack>
  );
};
