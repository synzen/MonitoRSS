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
  Link,
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
import { ExternalLinkIcon, RepeatIcon } from "@chakra-ui/icons";
import { Link as RouterLink } from "react-router-dom";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import {
  ExternalProperty,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../../../../types";
import { ArticleSelectDialog, SelectArticlePropertyType, useUserFeedArticles } from "../../../feed";
import { useGetUserFeedArticlesError } from "../../hooks";
import { useDebounce } from "../../../../hooks";
import { pages } from "../../../../constants";
import { UserFeedTabSearchParam } from "../../../../constants/userFeedTabSearchParam";

interface Props {
  externalProperties: ExternalProperty[];
  disabled?: boolean;
}

interface ConnectionFormatOptions {
  formatTables: boolean;
  stripImages: boolean;
  disableImageLinkPreviews: boolean;
  connectionId: string;
  connectionType: FeedConnectionType;
}

export const ExternalPropertyPreview = ({
  externalProperties: inputExternalProperties,
  disabled,
}: Props) => {
  const { userFeed } = useUserFeedContext();
  const initialFormatOptions: ConnectionFormatOptions | undefined = userFeed.connections
    .map((c) => {
      if (c.key === FeedConnectionType.DiscordChannel) {
        const connection = c as FeedDiscordChannelConnection;

        return {
          connectionId: connection.id,
          connectionType: connection.key,
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
        connectionId: string;
        connectionType: FeedConnectionType;
        formatTables: boolean;
        stripImages: boolean;
        disableImageLinkPreviews: boolean;
      }
    | undefined
  >(initialFormatOptions);
  const [articleId, setArticleId] = useState<string | undefined>();
  const { externalProperties } = useDebounce({ externalProperties: inputExternalProperties }, 500);
  const isIncomplete = externalProperties.some((i) => !i.sourceField || !i.cssSelector || !i.label);

  const { data, status, error, refetch, fetchStatus } = useUserFeedArticles({
    data: {
      limit: 1,
      skip: 0,
      selectProperties: ["id", ...externalProperties.map((p) => p.sourceField)],
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
        externalProperties,
        customPlaceholders: [],
      },
    },
    disabled: disabled || externalProperties.length === 0 || !formatOptions || isIncomplete,
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
        connectionId: c.id,
        connectionType: c.key,
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
    ([key, value]) => key.startsWith("external::") && !!value
  );

  if (isIncomplete) {
    return (
      <Alert status="warning" justifyContent="center" rounded="lg">
        <AlertDescription>
          The preview is disabled because one or more input fields are incomplete. Please fill in
          all required fields.
        </AlertDescription>
      </Alert>
    );
  }

  if (!initialFormatOptions) {
    return (
      <Alert status="warning" justifyContent="center" rounded="lg">
        <AlertDescription>
          The preview is disabled because there are no connections within this feed to preview with.
          To create connections, visit the{" "}
          <Link
            as={RouterLink}
            color="blue.300"
            to={pages.userFeed(userFeed.id, {
              tab: UserFeedTabSearchParam.Connections,
            })}
          >
            Connections
          </Link>{" "}
          page.
        </AlertDescription>
      </Alert>
    );
  }

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

  const article = data?.result.articles[0] as Record<string, string> | undefined;

  if (!article) {
    return (
      <Alert status="info" rounded="lg">
        <AlertTitle>No articles were found in the feed to preview</AlertTitle>
      </Alert>
    );
  }

  return (
    <Stack px={6} py={4}>
      <ArticleSelectDialog
        trigger={
          <Button size="sm" leftIcon={<RepeatIcon />}>
            Change Preview Article
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
          externalProperties,
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
      <HStack>
        <FormControl>
          <FormLabel>
            External Pages from Preview Article (
            <HStack display="inline">
              {externalProperties.map((p) => (
                <Code key={p.id}>{p.sourceField}</Code>
              ))}
            </HStack>
            )
          </FormLabel>
          <Stack>
            {externalProperties.map(({ sourceField, id }) => {
              const href = article[sourceField];

              if (!href) {
                return null;
              }

              return (
                <Link
                  key={id}
                  gap={2}
                  isExternal
                  target="_blank"
                  href={href || undefined}
                  rel="noopener noreferrer"
                  color="blue.300"
                >
                  {href}
                  <ExternalLinkIcon paddingLeft={1} />
                </Link>
              );
            })}
          </Stack>
        </FormControl>
      </HStack>
      <HStack>
        <FormControl flex={1}>
          <FormLabel>Preview Connection</FormLabel>
          <HStack flexWrap="wrap">
            <Select
              size="sm"
              width="auto"
              flex={1}
              onChange={(e) => onChangeSelectedConnection(e.target.value)}
            >
              {userFeed.connections.map((con) => (
                <option key={con.id} value={con.id}>
                  {con.name}
                </option>
              ))}
            </Select>
            {formatOptions && (
              <Button
                size="sm"
                variant="ghost"
                as={Link}
                href={pages.userFeedConnection({
                  feedId: userFeed.id,
                  connectionId: formatOptions.connectionId,
                  connectionType: formatOptions.connectionType,
                })}
                target="_blank"
                rightIcon={<ExternalLinkIcon />}
              >
                Manage Connection
              </Button>
            )}
          </HStack>
        </FormControl>
      </HStack>
      {!!articleEntries.length && (
        <Stack>
          <Box padding={2} rounded="lg" maxHeight={300} overflow="scroll">
            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th>Generated Property</Th>
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
          <Stack>
            <Text fontSize="sm" color="whiteAlpha.700" textAlign="center">
              These generated properties may be used while creating custom message formats per
              connection.
            </Text>
          </Stack>
        </Stack>
      )}
      {!articleEntries.length && (
        <Alert status="info" justifyContent="center">
          <AlertDescription>
            No additional properties were generated for this article. If this is unexpected,
            consider adjusting your CSS selector.
          </AlertDescription>
        </Alert>
      )}
    </Stack>
  );
};
