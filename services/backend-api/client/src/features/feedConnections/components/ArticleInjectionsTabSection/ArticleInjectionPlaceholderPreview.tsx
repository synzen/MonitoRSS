import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Center,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import { ArticleInjection } from "../../../../types";
import { SelectArticlePropertyType, useUserFeedArticles } from "../../../feed";
import { useGetUserFeedArticlesError } from "../../hooks";
import { useDebounce } from "../../../../hooks";

interface Props {
  articleInjections: ArticleInjection[];
  formatOptions?: {
    formatTables: boolean;
    stripImages: boolean;
    disableImageLinkPreviews: boolean;
  };
}

export const ArticleInjectionPlaceholderPreview = ({
  articleInjections: inputArticleInjections,
  formatOptions: inputFormatOptions,
}: Props) => {
  const { userFeed } = useUserFeedContext();

  const { articleInjections, formatOptions } = useDebounce(
    { articleInjections: inputArticleInjections, formatOptions: inputFormatOptions },
    500
  );
  const isIncomplete = articleInjections.some(
    (i) =>
      !i.sourceField || !i.selectors.length || i.selectors.some((s) => !s.cssSelector || !s.label)
  );

  const { data, status, error } = useUserFeedArticles({
    data: {
      limit: 1,
      skip: 0,
      selectProperties: ["*"],
      selectPropertyTypes: [SelectArticlePropertyType.ExternalInjections],
      formatter: {
        options: {
          dateFormat: userFeed.formatOptions?.dateFormat,
          dateTimezone: userFeed.formatOptions?.dateTimezone,
          formatTables: formatOptions?.formatTables ?? false,
          stripImages: formatOptions?.stripImages ?? false,
          disableImageLinkPreviews: formatOptions?.disableImageLinkPreviews ?? false,
        },
        articleInjections,
        customPlaceholders: [],
      },
    },
    disabled: articleInjections.length === 0 || !formatOptions || isIncomplete,
    feedId: userFeed.id,
  });

  const { alertComponent, hasAlert } = useGetUserFeedArticlesError({
    getUserFeedArticlesStatus: status,
    getUserFeedArticlesError: error,
    getUserFeedArticlesOutput: data,
  });

  if (hasAlert) {
    return alertComponent;
  }

  if (!data || status === "loading") {
    return (
      <Center flexDir="column" gap={2} bg="gray.800" rounded="lg" p={4}>
        <Spinner />
        <Text color="whiteAlpha.700" fontSize="sm">
          Loading preview...
        </Text>
      </Center>
    );
  }

  const article = data?.result.articles[0];

  if (!article) {
    return (
      <Alert status="info">
        <AlertTitle>No articles were found in the feed to preview</AlertTitle>
      </Alert>
    );
  }

  if (isIncomplete) {
    return (
      <Alert status="warning" justifyContent="center">
        <AlertDescription>
          The preview is disabled because one or more input fields are incomplete. Please fill in
          all required fields.
        </AlertDescription>
      </Alert>
    );
  }

  const articleEntries = Object.entries(article);

  if (!articleEntries.length) {
    return (
      <Alert status="info" justifyContent="center">
        <AlertDescription>
          No additional placeholders were generated. Consider adjusting your CSS selector.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Box bg="gray.800" padding={2} rounded="lg" maxHeight={300} overflow="scroll">
      <TableContainer>
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Placeholder</Th>
              <Th>Sample Article Placeholder Value</Th>
            </Tr>
          </Thead>
          <Tbody>
            {articleEntries.map(([key, value]) => (
              <Tr key={key}>
                <Td>{key}</Td>
                <Td>{value}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};
