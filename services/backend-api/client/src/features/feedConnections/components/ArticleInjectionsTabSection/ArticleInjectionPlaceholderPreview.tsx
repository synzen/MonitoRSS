import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  Center,
  Code,
  FormControl,
  FormLabel,
  HStack,
  Select,
  Skeleton,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useState } from "react";
import { FiMousePointer } from "react-icons/fi";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import {
  ArticleInjection,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../../../../types";
import { ArticleSelectDialog, SelectArticlePropertyType, useUserFeedArticles } from "../../../feed";
import { useGetUserFeedArticlesError } from "../../hooks";
import { useDebounce } from "../../../../hooks";

interface Props {
  articleInjections: ArticleInjection[];
  disabled?: boolean;
}

interface ConnectionFormatOptions {
  formatTables: boolean;
  stripImages: boolean;
  disableImageLinkPreviews: boolean;
}

export const ArticleInjectionPlaceholderPreview = ({
  articleInjections: inputArticleInjections,
  disabled,
}: Props) => {
  const { userFeed } = useUserFeedContext();
  const initialFormatOptions: ConnectionFormatOptions | undefined = userFeed.connections
    .map((c) => {
      if (c.key === FeedConnectionType.DiscordChannel) {
        const connection = c as FeedDiscordChannelConnection;

        return {
          formatTables: connection.details.formatter.formatTables,
          stripImages: connection.details.formatter.stripImages,
          disableImageLinkPreviews: connection.details.formatter.disableImageLinkPreviews,
        };
      }

      return null;
    })
    .find((c): c is Exclude<typeof c, null> => c !== null);
  const [formatOptions, setFormatOptions] = useState<
    | {
        formatTables: boolean;
        stripImages: boolean;
        disableImageLinkPreviews: boolean;
      }
    | undefined
  >(initialFormatOptions);
  const [articleId, setArticleId] = useState<string | undefined>();
  const { articleInjections } = useDebounce({ articleInjections: inputArticleInjections }, 500);
  const isIncomplete = articleInjections.some(
    (i) =>
      !i.sourceField || !i.selectors.length || i.selectors.some((s) => !s.cssSelector || !s.label)
  );

  const { data, status, error, refetch, fetchStatus } = useUserFeedArticles({
    data: {
      limit: 1,
      skip: 0,
      selectProperties: ["id"],
      filters: articleId
        ? {
            articleId,
          }
        : undefined,
      random: true,
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
    disabled: disabled || articleInjections.length === 0 || !formatOptions || isIncomplete,
    feedId: userFeed.id,
  });

  const { alertComponent, hasAlert } = useGetUserFeedArticlesError({
    getUserFeedArticlesStatus: status,
    getUserFeedArticlesError: error,
    getUserFeedArticlesOutput: data,
  });

  const onChangeSelectedConnection = (connectionId: string) => {
    const connection = userFeed.connections.find((c) => c.id === connectionId);

    if (!connection) {
      return;
    }

    if (connection.key === FeedConnectionType.DiscordChannel) {
      const c = connection as FeedDiscordChannelConnection;

      setFormatOptions({
        formatTables: c.details.formatter.formatTables,
        stripImages: c.details.formatter.stripImages,
        disableImageLinkPreviews: c.details.formatter.disableImageLinkPreviews,
      });
    }
  };

  if (hasAlert) {
    return alertComponent;
  }

  const articleEntries = Object.entries(data?.result.articles[0] || {}).filter(
    ([key, value]) => !key.startsWith("id") && !!value
  );

  if (
    !data ||
    status === "loading" ||
    (data && !articleEntries.length && fetchStatus === "fetching")
  ) {
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

  return (
    <Stack px={4} py={2}>
      <HStack>
        <FormControl flex={1}>
          <FormLabel>Connection</FormLabel>
          <Select size="sm" onChange={(e) => onChangeSelectedConnection(e.target.value)}>
            {userFeed.connections.map((con) => (
              <option key={con.id} value={con.id}>
                {con.name}
              </option>
            ))}
          </Select>
        </FormControl>
        <ArticleSelectDialog
          trigger={
            <Button size="sm" alignSelf="flex-end" leftIcon={<FiMousePointer />}>
              Select Article
            </Button>
          }
          feedId={userFeed.id}
          articleFormatter={{
            options: {
              dateFormat: userFeed.formatOptions?.dateFormat,
              dateTimezone: userFeed.formatOptions?.dateTimezone,
              formatTables: formatOptions?.formatTables ?? false,
              stripImages: formatOptions?.stripImages ?? false,
              disableImageLinkPreviews: formatOptions?.disableImageLinkPreviews ?? false,
            },
            articleInjections,
            customPlaceholders: [],
          }}
          onArticleSelected={(id) => setArticleId(id)}
          onClickRandomArticle={() => {
            if (articleId) {
              setArticleId(undefined);
            } else {
              refetch();
            }
          }}
        />
      </HStack>
      {!!articleEntries.length && (
        <Box padding={2} rounded="lg" maxHeight={300} overflow="scroll">
          <TableContainer>
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Placeholder</Th>
                  <Th>Value</Th>
                </Tr>
              </Thead>
              <Tbody>
                {articleEntries.map(([key, value]) => {
                  return (
                    <Tr key={key}>
                      <Td>
                        <Skeleton isLoaded={fetchStatus === "idle"}>
                          <Code>{key}</Code>
                        </Skeleton>
                      </Td>
                      <Td>
                        <Skeleton isLoaded={fetchStatus === "idle"}>{value}</Skeleton>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      )}
      {!articleEntries.length && (
        <Alert status="info" justifyContent="center">
          <AlertDescription>
            No additional placeholders were generated for this article. If this is unexpected,
            consider adjusting your CSS selector.
          </AlertDescription>
        </Alert>
      )}
    </Stack>
  );
};
