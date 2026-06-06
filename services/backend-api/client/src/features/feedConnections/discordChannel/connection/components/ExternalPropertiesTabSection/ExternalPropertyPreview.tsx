import {
  Alert,
  Box,
  Button,
  Center,
  HStack,
  Link,
  List,
  Skeleton,
  Spinner,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { FaUpRightFromSquare, FaArrowsRotate } from "react-icons/fa6";
import { Link as RouterLink } from "react-router-dom";
import { Field } from "@/components/ui/field";
import { NativeSelectRoot, NativeSelectField } from "@/components/ui/native-select";
import {
  useUserFeedContext,
  UserFeedConnectionContext,
  UserFeedConnectionProvider,
  useUserFeedConnectionContext,
  ArticleSelectDialog,
  SelectArticlePropertyType,
  useUserFeedArticles,
  ExternalContentError,
} from "@/features/feed";
import { ExternalProperty } from "@/types";
import { useGetUserFeedArticlesError } from "../../hooks";
import { useDebounce } from "@/hooks";
import { pages } from "@/constants";
import { UserFeedTabSearchParam } from "@/constants/userFeedTabSearchParam";

import MessagePlaceholderText from "../../../messageBuilder/components/MessagePlaceholderText";
import { ExternalContentErrorsAlert } from "./ExternalContentErrorsAlert";

interface Props {
  externalProperties: ExternalProperty[];
}

const ArticlesSection = ({ externalProperties, articleId }: Props & { articleId?: string }) => {
  const { userFeed, articleFormatOptions } = useUserFeedConnectionContext();
  const isIncomplete = externalProperties.some((i) => !i.sourceField || !i.cssSelector || !i.label);
  const queryData = {
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
    includeHtmlInErrors: true,
    formatOptions: {
      formatTables: articleFormatOptions?.formatTables ?? false,
      stripImages: articleFormatOptions?.stripImages ?? false,
      disableImageLinkPreviews: articleFormatOptions?.disableImageLinkPreviews ?? false,
      ignoreNewLines: articleFormatOptions?.ignoreNewLines ?? false,
      dateFormat: articleFormatOptions?.dateFormat,
      dateTimezone: articleFormatOptions?.dateTimezone,
      customPlaceholders: [],
      externalProperties,
    },
  };

  const { data, status, error, fetchStatus } = useUserFeedArticles({
    data: queryData,
    disabled: externalProperties.length === 0 || isIncomplete,
    feedId: userFeed.id,
    queryKeyFields: externalProperties.map((p) => `external-property-preview-page-${p.id}`),
  });

  const articleEntries = Object.entries(data?.result.articles[0] || {}).filter(
    ([key, value]) => key.startsWith("external::") && !!value,
  );

  const externalContentErrors = (data?.result.externalContentErrors ||
    []) as ExternalContentError[];

  const { alertComponent, hasAlert } = useGetUserFeedArticlesError({
    getUserFeedArticlesStatus: status,
    getUserFeedArticlesError: error,
    getUserFeedArticlesOutput: data,
  });

  if (hasAlert) {
    return alertComponent;
  }

  const article = data?.result.articles[0] as Record<string, string> | undefined;

  if (status === "loading" || !data) {
    return (
      <Center flexDir="column" gap={2} bg="bg.subtle" rounded="lg" p={4}>
        <Spinner />
        <Text color="fg.muted" fontSize="sm" aria-live="polite">
          Loading preview...this might take a while
        </Text>
      </Center>
    );
  }

  if (!article) {
    return (
      <Alert.Root status="info" rounded="lg">
        <Alert.Content>
          <Alert.Title>No articles were found in the feed to preview</Alert.Title>
        </Alert.Content>
      </Alert.Root>
    );
  }

  const someExternalWebPageLinkExists = externalProperties.some((i) => !!article[i.sourceField]);

  const externalLinksSection = someExternalWebPageLinkExists && (
    <Stack mb={4}>
      <Text display="block" fontSize="sm">
        Content scraped from:
      </Text>
      <List.Root>
        {externalProperties.map(({ sourceField, id }) => {
          const href = article[sourceField];

          if (!href) {
            return null;
          }

          return (
            <List.Item key={id}>
              <Link
                key={id}
                gap={2}
                target="_blank"
                href={href || undefined}
                rel="noopener noreferrer"
                color="text.link"
              >
                {href}
                <FaUpRightFromSquare style={{ paddingLeft: 1, display: "inline" }} />
              </Link>
            </List.Item>
          );
        })}
      </List.Root>
    </Stack>
  );

  if (!articleEntries.length) {
    if (fetchStatus === "fetching") {
      return (
        <Center flexDir="column" gap={2} bg="bg.subtle" rounded="lg" p={4}>
          <Spinner />
          <Text color="fg.muted" fontSize="sm">
            Loading preview...
          </Text>
        </Center>
      );
    }

    if (externalContentErrors.length > 0) {
      return (
        <Stack>
          {externalLinksSection}
          <ExternalContentErrorsAlert errors={externalContentErrors} />
        </Stack>
      );
    }

    return (
      <Alert.Root status="info" justifyContent="center">
        <Alert.Content>
          <Alert.Description>
            No external placeholders were generated for this article. If this is unexpected,
            consider adjusting your CSS selector or select a different preview article.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  return (
    <Stack>
      <Box srOnly aria-live="polite">
        {articleEntries.length > 0 && fetchStatus === "idle" && (
          <span>Finished loading ${articleEntries.length} external properties</span>
        )}
        {fetchStatus === "fetching" && <span>Loading preview...</span>}
      </Box>
      <Box padding={2} rounded="lg" maxHeight={300} overflow="scroll">
        {externalLinksSection}
        <Table.ScrollArea>
          <Table.Root size="sm" variant="line">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Generated Placeholder</Table.ColumnHeader>
                <Table.ColumnHeader>Value</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {articleEntries.map(([key, value]) => {
                return (
                  <Table.Row key={key}>
                    <Table.Cell>
                      <Skeleton loading={fetchStatus !== "idle"}>
                        <MessagePlaceholderText withBrackets>{key}</MessagePlaceholderText>
                      </Skeleton>
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton loading={fetchStatus !== "idle"}>{value}</Skeleton>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
      </Box>
      {externalContentErrors.length > 0 && (
        <ExternalContentErrorsAlert errors={externalContentErrors} />
      )}
      <Stack>
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          These generated placeholders may be used while creating custom message formats per
          connection.
        </Text>
      </Stack>
    </Stack>
  );
};

export const ExternalPropertyPreview = ({ externalProperties: inputExternalProperties }: Props) => {
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
    userFeed.connections[0]?.id,
  );
  const [articleId, setArticleId] = useState<string | undefined>();
  const { externalProperties } = useDebounce({ externalProperties: inputExternalProperties }, 500);
  const isIncomplete = externalProperties.some((i) => !i.sourceField || !i.cssSelector || !i.label);

  const { data, status, error, fetchStatus } = useUserFeedArticles({
    data: {
      limit: 1,
      skip: 0,
      selectProperties: ["*"],
      random: true,
      formatOptions: {
        formatTables: false,
        stripImages: false,
      },
    },
    disabled: externalProperties.length === 0,
    feedId: userFeed.id,
  });

  const { alertComponent, hasAlert } = useGetUserFeedArticlesError({
    getUserFeedArticlesStatus: status,
    getUserFeedArticlesError: error,
    getUserFeedArticlesOutput: data,
  });

  const onChangeSelectedConnection = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
  };

  if (hasAlert) {
    return alertComponent;
  }

  if (isIncomplete) {
    return (
      <Alert.Root status="warning" justifyContent="center" rounded="lg">
        <Alert.Content>
          <Alert.Description>
            The preview is disabled because one or more input fields are incomplete. Please fill in
            all required fields.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (!userFeed.connections.length) {
    return (
      <Alert.Root status="warning" justifyContent="center" rounded="lg">
        <Alert.Content>
          <Alert.Description>
            The preview is disabled because there are no connections within this feed to preview
            with. To create connections, visit the{" "}
            <Link asChild color="text.link">
              <RouterLink
                to={pages.userFeed(userFeed.id, {
                  tab: UserFeedTabSearchParam.Connections,
                })}
              >
                Connections
              </RouterLink>
            </Link>{" "}
            page.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  return (
    <Stack px={[4, 4, 6]} py={4}>
      <Box srOnly aria-live="polite">
        {fetchStatus === "fetching" && <span>Loading preview...</span>}
      </Box>
      <UserFeedConnectionProvider feedId={userFeed.id} connectionId={selectedConnectionId}>
        <UserFeedConnectionContext.Consumer>
          {(connectionContext) => {
            return (
              <>
                <HStack w="full">
                  <Field
                    flex={1}
                    label={
                      <span id={`preview-connection-${inputExternalProperties.map((p) => p.id)}`}>
                        Preview Connection
                      </span>
                    }
                  >
                    <HStack flexWrap="wrap" w="full">
                      <NativeSelectRoot size="sm" width="auto" flex={1} minWidth={200}>
                        <NativeSelectField
                          onChange={(e) => onChangeSelectedConnection(e.target.value)}
                          aria-labelledby={`preview-connection-${inputExternalProperties.map(
                            (p) => p.id,
                          )}`}
                        >
                          {userFeed.connections.map((con) => (
                            <option key={con.id} value={con.id}>
                              {con.name}
                            </option>
                          ))}
                        </NativeSelectField>
                      </NativeSelectRoot>
                      {connectionContext && (
                        <Button size="sm" variant="ghost" asChild>
                          <a
                            href={pages.userFeedConnection({
                              feedId: userFeed.id,
                              connectionId: connectionContext.connection.id,
                              connectionType: connectionContext.connection.key,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Manage Connection
                            <FaUpRightFromSquare />
                          </a>
                        </Button>
                      )}
                    </HStack>
                  </Field>
                </HStack>
                <ArticlesSection externalProperties={externalProperties} articleId={articleId} />
                <ArticleSelectDialog
                  trigger={
                    <Button size="sm" mt={4}>
                      <FaArrowsRotate />
                      Change Preview Article
                    </Button>
                  }
                  feedId={userFeed.id}
                  onArticleSelected={(id) => setArticleId(id)}
                  articleFormatOptions={articleFormatOptions}
                />
              </>
            );
          }}
        </UserFeedConnectionContext.Consumer>
      </UserFeedConnectionProvider>
    </Stack>
  );
};
