import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedSelect } from '../../../../components';
import { GetArticlesFilterReturnType } from '../../../feed/constants';
import {
  useUserFeedArticleProperties,
  useUserFeedArticlesWithPagination,
} from '../../../feed/hooks';
import { UserFeedArticleRequestStatus } from '../../../feed/types';
import { getErrorMessageForArticleRequestStatus } from '../../../feed/utils';
import { LogicalFilterExpression } from '../../types';
import { ArticleFilterResultsTable } from '../ArticleFilterResultsTable';
import { FiltersForm } from '../FiltersForm';

interface Props {
  feedId?: string
  filters?: LogicalFilterExpression | null
  onFiltersUpdated: (filters: LogicalFilterExpression | null) => Promise<void>
}

export const FiltersTabSection = ({ feedId, filters, onFiltersUpdated }: Props) => {
  const [selectedArticleProperty, setSelectedArticleProperty] = useState<
  string | undefined
  >(undefined);

  const {
    data: feedArticlePropertiesResult,
    status: feedArticlePropertiesStatus,
  } = useUserFeedArticleProperties({ feedId });
  const {
    data: userFeedArticlesResults,
    status: userFeedArticlesStatus,
    fetchStatus,
    nextPage,
    prevPage,
    skip,
    limit,
  } = useUserFeedArticlesWithPagination({
    feedId,
    data: {
      selectProperties: selectedArticleProperty ? [selectedArticleProperty, 'id'] : ['id'],
      filters: {
        returnType: GetArticlesFilterReturnType.IncludeEvaluationResults,
        expression: filters || undefined,
      },
    },
  });
  const { t } = useTranslation();

  const onChangeFeedArticleProperty = (value: string) => {
    setSelectedArticleProperty(value);
  };

  const articles = userFeedArticlesResults?.result.articles;
  const filterResultsByIndex = userFeedArticlesResults?.result.filterStatuses;
  const useArticleProperty = selectedArticleProperty
    || userFeedArticlesResults?.result.selectedProperties[0];
  const totalArticles = userFeedArticlesResults?.result.totalArticles;
  const requestStatus = userFeedArticlesResults?.result.requestStatus;

  const onFirstPage = skip === 0;
  const onLastPage = !totalArticles || skip + limit >= totalArticles;

  const fetchErrorAlert = userFeedArticlesStatus === 'error' && (
    <Alert status="error">
      <AlertIcon />
      {t('common.errors.somethingWentWrong')}
    </Alert>
  );

  const parseErrorAlert = requestStatus
    && requestStatus !== UserFeedArticleRequestStatus.Success && (
    <Alert status="error">
      <AlertIcon />
      {t(getErrorMessageForArticleRequestStatus(
        requestStatus,
        userFeedArticlesResults?.result?.response?.statusCode,
      ))}
    </Alert>
  );

  const noArticlesAlert = userFeedArticlesResults?.result.totalArticles === 0 && (
    <Alert status="info">
      <AlertIcon />
      {t('features.feedConnections.components.filtersTabSection.noArticles')}
    </Alert>
  );

  const hasAlert = !!(fetchErrorAlert || parseErrorAlert || noArticlesAlert);

  return (
    <Stack spacing={12} paddingBottom={6}>
      <Stack spacing={4}>
        <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={6}>
          <Heading as="h2" size="md">
            {t('features.feedConnections.components.filtersTabSection.headingSamplePlaceholders')}
          </Heading>
          {!hasAlert && (
          <HStack alignItems="center">
            <Text whiteSpace="nowrap">
              {t('features.feedConnections.components'
                + '.filtersTabSection.displayPropertyDropdownLabel')}
            </Text>
            <Box width={{ md: '250px', lg: '350px' }}>
              <ThemedSelect
                options={feedArticlePropertiesResult?.result.properties.map((property) => ({
                  value: property,
                  label: property,
                })) || []}
                isDisabled={feedArticlePropertiesStatus === 'loading'}
                loading={feedArticlePropertiesStatus === 'loading'}
                value={useArticleProperty}
                onChange={onChangeFeedArticleProperty}
              />
            </Box>
          </HStack>
          )}
        </Flex>
        <Box marginBottom="8">
          {fetchErrorAlert || parseErrorAlert || noArticlesAlert}
          {userFeedArticlesStatus === 'loading'
            && (
            <Stack alignItems="center">
              <Spinner size="xl" />
              <Text>
                {t('features.feedConnections.components.filtersTabSection.loadingArticles')}
              </Text>
            </Stack>
            )}
          {!hasAlert && userFeedArticlesStatus !== 'loading'
            && (
              <Stack>
                <ArticleFilterResultsTable
                  articles={
                    articles?.map(
                      (article: Record<string, any>, index) => ({
                        id: article.id,
                        passedFilters: filterResultsByIndex?.[index]?.passed,
                        propertyValue: article?.[useArticleProperty as string] as string,
                      }),
                    ) || []
                  }
                  displayPropertyName={useArticleProperty as string}
                />
                <Flex justifyContent="space-between">
                  {t('common.table.results', {
                    start: skip + 1,
                    end: skip + limit,
                    total: totalArticles,
                  })}
                  <HStack>
                    <Button
                      width="min-content"
                      onClick={prevPage}
                      isDisabled={onFirstPage || fetchStatus === 'fetching'}
                    >
                      {t('features.feedConnections.components.filtersTabSection.prevPage')}
                    </Button>
                    <Button
                      width="min-content"
                      onClick={nextPage}
                      isDisabled={onLastPage || fetchStatus === 'fetching'}
                    >
                      {t('features.feedConnections.components.filtersTabSection.nextPage')}
                    </Button>
                  </HStack>
                </Flex>
              </Stack>
            )}
        </Box>
      </Stack>
      <Stack spacing={4}>
        <Heading
          as="h2"
          size="md"
        >
          {t('features.feedConnections.components.filtersTabSection.headingSettings')}
        </Heading>
        <FiltersForm
          onSave={onFiltersUpdated}
          expression={filters}
        />
      </Stack>
    </Stack>
  );
};
