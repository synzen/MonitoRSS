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
import { DiscordMessageForm } from '../../../../components';
import { DiscordMessageFormData } from '../../../../types/discord';
import { notifyError } from '../../../../utils/notifyError';
import { useUserFeedArticles } from '../../../feed/hooks';
import { ArticlePlaceholderTable } from '../ArticlePlaceholderTable';

interface Props {
  feedId?: string
  defaultMessageValues?: DiscordMessageFormData
  onMessageUpdated: (data: DiscordMessageFormData) => Promise<void>
}

export const MessageTabSection = ({ feedId, defaultMessageValues, onMessageUpdated }: Props) => {
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
      {t('features.feedConnections.components.articlePlaceholderTable.noArticles')}
    </Alert>
  );

  const hasAlert = !!(fetchErrorAlert || parseErrorAlert || noArticlesAlert);

  return (
    <Stack spacing={12}>
      <Stack spacing={4}>
        <Flex justifyContent="space-between" alignItems="center">
          <Heading as="h2" size="md">
            {t('features.feedConnections.components.'
              + 'articlePlaceholderTable.headingSamplePlaceholders')}

          </Heading>
          {!hasAlert && (
          <Button
            size="sm"
            leftIcon={<RepeatIcon />}
            isLoading={userFeedArticlesFetchStatus === 'fetching'}
            onClick={onClickRandomFeedArticle}
          >
            {t('features.feedConnections.components.articlePlaceholderTable.randomButton')}
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
                {t('features.feedConnections.components.articlePlaceholderTable.loadingArticle')}
              </Text>
            </Stack>
            )}
          {!hasAlert && firstArticle
            && (
            <ArticlePlaceholderTable
              asPlaceholders
              article={userFeedArticles.result.articles[0]}
            />
            )}
        </Box>
      </Stack>
      <Stack spacing={4}>
        <DiscordMessageForm
          onClickSave={onMessageUpdated}
          defaultValues={defaultMessageValues}
        />
      </Stack>
    </Stack>
  );
};
