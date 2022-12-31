import {
  Alert,
  AlertIcon,
  Box,
  Flex,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { ThemedSelect } from '../../../../components';
import { GetArticlesFilterReturnType } from '../../../feed/constants';
import { useUserFeedArticles } from '../../../feed/hooks';
import { LogicalFilterExpression } from '../../types';
import { ArticleFilterResultsTable } from '../ArticleFilterResultsTable';
import { FiltersForm } from '../FiltersForm';

interface Props {
  feedId?: string
  filters?: LogicalFilterExpression | null
  onFiltersUpdated: (filters: LogicalFilterExpression | null) => Promise<void>
}

export const FiltersTabSection = ({ feedId, filters, onFiltersUpdated }: Props) => {
  const {
    data: userFeedArticlesResults,
    status: userFeedArticlesStatus,
  } = useUserFeedArticles({
    feedId,
    data: {
      limit: 1,
      random: true,
      filters: !filters ? undefined : {
        returnType: GetArticlesFilterReturnType.IncludeEvaluationResults,
        expression: filters,
      },
    },
  });
  const { t } = useTranslation();

  const articles = userFeedArticlesResults?.result.articles;
  const selectedArticleProperty = userFeedArticlesResults?.result.selectedProperties[0];
  const filterResultsByIndex = userFeedArticlesResults?.result.filterStatuses;

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

  const noArticlesAlert = userFeedArticlesResults?.result.articles.length === 0 && (
    <Alert status="info">
      <AlertIcon />
      {t('features.feedConnections.components.filtersTabSection.noArticles')}
    </Alert>
  );

  const hasAlert = !!(fetchErrorAlert || parseErrorAlert || noArticlesAlert);

  return (
    <Stack spacing={12}>
      <Stack spacing={4}>
        <Flex justifyContent="space-between" alignItems="center">
          <Heading as="h2" size="md">
            {t('features.feedConnections.components.filtersTabSection.headingSamplePlaceholders')}
          </Heading>
          {!hasAlert && (
            <HStack alignItems="center">
              <Text>
                {t('features.feedConnections.components'
                + '.filtersTabSection.displayPropertyDropdownLabel')}
              </Text>
              <ThemedSelect
                options={[{
                  label: 'title',
                  value: 'title',
                }]}
                value={selectedArticleProperty}
                onChange={console.log}
              />
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
          {!hasAlert && articles
            && (
            <ArticleFilterResultsTable
              articles={
                articles.map(
                  (article: Record<string, any>, index) => ({
                    passedFilters: filterResultsByIndex?.[index].passed as boolean,
                    propertyValue: article?.[selectedArticleProperty as string] as string,
                  }),
                )
              }
              displayPropertyName={selectedArticleProperty as string}
            />
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
