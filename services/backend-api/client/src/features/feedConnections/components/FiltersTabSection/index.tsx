import { RepeatIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { notifyError } from '../../../../utils/notifyError';
import { useUserFeedArticles } from '../../../feed/hooks';
import { LogicalFilterExpression } from '../../types';
import { ArticlePlaceholderTable } from '../ArticlePlaceholderTable';
import { FiltersForm } from '../FiltersForm';

interface Props {
  feedId?: string
  filters?: LogicalFilterExpression | null
  onFiltersUpdated: (filters: LogicalFilterExpression | null) => Promise<void>
}

export const FiltersTabSection = ({ feedId, filters, onFiltersUpdated }: Props) => {
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
    },
  });
  const { t } = useTranslation();

  const onClickRandomFeedArticle = async () => {
    try {
      await refetchUserFeedArticle();
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  const firstArticle = userFeedArticles?.result.articles[0];

  const fetchErrorAlert = userFeedArticlesStatus === 'error' && (
    <Alert status="error">
      <AlertIcon />
      {t('common.errors.somethingWentWrong')}
    </Alert>
  );

  const parseErrorAlert = userFeedArticles?.result.requestStatus === 'parse_error' && (
    <Alert status="error">
      <AlertIcon />
      {t('common.apiErrors.feedParseFailed')}
    </Alert>
  );

  const noArticlesAlert = userFeedArticles?.result.articles.length === 0 && (
    <Alert status="info">
      <AlertIcon />
      {t('features.feedConnections.components.filtersSection.noArticles')}
    </Alert>
  );

  const hasAlert = !!(fetchErrorAlert || parseErrorAlert || noArticlesAlert);

  return (
    <Stack spacing={8}>
      <Stack spacing={4}>
        <Flex justifyContent="space-between" alignItems="center">
          <Heading as="h2" size="md">
            {t('features.feedConnections.components.filtersSection.headingSamplePlaceholders')}

          </Heading>
          {!hasAlert && (
          <Button
            size="sm"
            leftIcon={<RepeatIcon />}
            isLoading={userFeedArticlesFetchStatus === 'fetching'}
            onClick={onClickRandomFeedArticle}
          >
            {t('features.feedConnections.components.filtersSection.randomButton')}
          </Button>
          )}
        </Flex>
        <Box marginBottom="8">
          {fetchErrorAlert || parseErrorAlert || noArticlesAlert}
          {userFeedArticlesStatus === 'loading'
            && (
            <Stack alignItems="center">
              <Spinner size="xl" />
              <Text>
                {t('features.feedConnections.components.filtersSection.loadingArticle')}
              </Text>
            </Stack>
            )}
          {!hasAlert && firstArticle
            && <ArticlePlaceholderTable article={userFeedArticles.result.articles[0]} />}
        </Box>
      </Stack>
      <Stack spacing={4}>
        <Heading
          as="h2"
          size="md"
        >
          {t('features.feedConnections.components.filtersSection.headingSettings')}
        </Heading>
        <FiltersForm
          onSave={onFiltersUpdated}
          expression={filters}
        />
      </Stack>
    </Stack>
  );
};
