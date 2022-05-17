import {
  Alert,
  AlertDescription,
  AlertIcon, AlertTitle, Box, Code, Select, Stack, StackDivider, Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loading } from '@/components';
import { useFeedArticles } from '../../hooks/useFeedArticles';
import { FeedDumpButton } from '../FeedRawDumpButton';

interface Props {
  feedId?: string
}

export const FeedArticlesPlaceholders: React.FC<Props> = ({ feedId }) => {
  const [articleIndex, setArticleIndex] = useState(0);
  const { t } = useTranslation();
  const { articles, status, error } = useFeedArticles({ feedId });

  if (status === 'loading' || status === 'idle') {
    return <Loading />;
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <Box>
          <AlertTitle display="block">
            {t('pages.message.failedToRetrieveArticlesError')}
          </AlertTitle>
          <AlertDescription display="block">
            {error.message}
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  const onChangeArticleIndex = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setArticleIndex(Number(event.target.value));
  };

  // There may be no articles in the feed
  const selectedArticle = articles?.[articleIndex];

  return (
    <Stack spacing="4">
      <Stack>
        <Select value={articleIndex} onChange={onChangeArticleIndex}>
          {articles.map((article, index) => (
            <option key={article.id} value={index}>
              {article.title}
            </option>
          ))}
        </Select>
        <Stack
          borderRadius="8"
          borderStyle="solid"
          borderWidth="1px"
          maxHeight="350px"
          padding="4"
          overflow="auto"
          divider={<StackDivider />}
        >
          {selectedArticle?.placeholders.public.map((placeholder) => (
            <Stack display="inline-block" key={placeholder.value}>
              <Code>{placeholder.name}</Code>
              <Text>{placeholder.value}</Text>
            </Stack>
          ))}
        </Stack>
      </Stack>
      <Stack spacing="3">
        <Text>
          {t('pages.message.placeholdersRawSectionDescription')}
        </Text>
        <FeedDumpButton feedId={feedId} />
      </Stack>
    </Stack>
  );
};
