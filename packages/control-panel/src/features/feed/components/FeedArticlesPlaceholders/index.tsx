import {
  Alert,
  AlertIcon,
  Box, Code, Select, Stack, StackDivider, Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FeedArticle } from '../../../../types/FeedArticle';

interface Props {
  loading?: boolean
  error?: Error | null
  articles: FeedArticle[]
}

export const FeedArticlesPlaceholders: React.FC<Props> = ({ loading, articles, error }) => {
  const [articleIndex, setArticleIndex] = useState(0);

  if (loading) {
    return <Box>Loading</Box>;
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
        {selectedArticle?.placeholders.map((placeholder) => (
          <Stack display="inline-block" key={placeholder.value}>
            <Code>{placeholder.name}</Code>
            <Text>{placeholder.value}</Text>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};
