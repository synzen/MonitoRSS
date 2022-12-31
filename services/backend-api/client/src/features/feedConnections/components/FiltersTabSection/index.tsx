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
import { useUserFeedArticleProperties } from '../../../feed/hooks';
import {
  useUserFeedArticlesWithLoadMore,
} from '../../../feed/hooks/useUserFeedArticlesWithLoadMore';
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
    allArticles,
    allArticleFilterResults,
    data: userFeedArticlesResults,
    status: userFeedArticlesStatus,
    loadMore,
    hasMore,
    fetchStatus,
  } = useUserFeedArticlesWithLoadMore({
    feedId,
    data: {
      selectProperties: selectedArticleProperty ? [selectedArticleProperty] : undefined,
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

  const articles = allArticles;
  const filterResultsByIndex = allArticleFilterResults;
  const useArticleProperty = selectedArticleProperty
    || userFeedArticlesResults?.result.selectedProperties[0];

  const fetchErrorAlert = userFeedArticlesStatus === 'error' && (
    <Alert status="error">
      <AlertIcon />
      {t('common.errors.somethingWentWrong')}
    </Alert>
  );

  const parseErrorAlert = userFeedArticlesResults?.result.requestStatus === 'parse_error' && (
    <Alert status="error">
      <AlertIcon />
      {t('common.apiErrors.feedParseFailed')}
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
    <Stack spacing={12}>
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
                articles.map(
                  (article: Record<string, any>, index) => ({
                    passedFilters: filterResultsByIndex?.[index]?.passed,
                    propertyValue: article?.[useArticleProperty as string] as string,
                  }),
                )
              }
                  displayPropertyName={useArticleProperty as string}
                />
                <Stack alignItems="center">
                  <Button
                    width="min-content"
                    variant="ghost"
                    onClick={loadMore}
                    isLoading={fetchStatus === 'fetching'}
                    isDisabled={fetchStatus === 'fetching'}
                    disabled={!hasMore}
                  >
                    {t('features.feedConnections.components.filtersTabSection.loadMoreButton')}
                  </Button>
                </Stack>
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
