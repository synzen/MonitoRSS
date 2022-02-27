import {
  Alert,
  AlertIcon, Code, Select, Stack, StackDivider, Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { Loading } from '@/components';
import { useFeedArticles } from '../../hooks/useFeedArticles';

interface Props {
  feedId?: string
}

export const FeedArticlesPlaceholders: React.FC<Props> = ({ feedId }) => {
  const [articleIndex, setArticleIndex] = useState(0);

  const { articles, status, error } = useFeedArticles({ feedId });

  if (status === 'loading' || status === 'idle') {
    return <Loading />;
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        {error.message}
      </Alert>
    );
  }

  const onChangeArticleIndex = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setArticleIndex(Number(event.target.value));
  };

  const selectedArticle = articles[articleIndex];

  return (
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
        {selectedArticle.placeholders.public.map((placeholder) => (
          <Stack display="inline-block" key={placeholder.value}>
            <Code>{placeholder.name}</Code>
            <Text>{placeholder.value}</Text>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};
