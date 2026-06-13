import {
  Alert,
  Box,
  Button,
  Card,
  Center,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  Separator,
  Spinner,
  Stack,
  Text,
  Link as ChakraLink,
  Badge,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiMousePointer } from "react-icons/fi";
import { useState } from "react";
import { FaExpandAlt } from "react-icons/fa";
import { FaChevronRight, FaArrowsRotate, FaMagnifyingGlass } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { DiscordMessageFormData } from "@/types/discord";
import {
  useUserFeedArticles,
  ArticleSelectDialog,
  useUserFeedConnectionContext,
  useFeedScope,
} from "@/features/feed";
import { ArticlePlaceholderTable } from "../ArticlePlaceholderTable";
import { DiscordMessageForm, SaveExtra } from "../DiscordMessageForm";
import { pages } from "@/constants";
import { UserFeedConnectionTabSearchParam } from "@/constants/userFeedConnectionTabSearchParam";
import { UserFeedTabSearchParam } from "@/constants/userFeedTabSearchParam";
import { useGetUserFeedArticlesError } from "../../hooks";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { FeedDiscordChannelConnection } from "@/types";
import {
  AccordionRoot,
  AccordionItem,
  AccordionItemTrigger,
  AccordionItemContent,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { PrimaryActionButton } from "../../../../../../components";

interface Props {
  onMessageUpdated: (data: DiscordMessageFormData, extra?: SaveExtra) => Promise<void>;
  guildId: string | undefined;
}

export const MessageTabSection = ({ onMessageUpdated, guildId }: Props) => {
  const { userFeed, connection, articleFormatOptions } =
    useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { workspaceSlug } = useFeedScope();
  const scope = workspaceSlug ? { workspaceSlug } : undefined;
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();

  // Check if V2 components are configured
  const hasComponentsV2 =
    connection.details?.componentsV2 && connection.details.componentsV2.length > 0;
  const [placeholderTableSearch, setPlaceholderTableSearch] = useState<string>("");
  const [hideEmptyPlaceholders, setHideEmptyPlaceholders] = useState<boolean>(false);
  const {
    data: userFeedArticles,
    refetch: refetchUserFeedArticle,
    fetchStatus: userFeedArticlesFetchStatus,
    status: userFeedArticlesStatus,
    error,
  } = useUserFeedArticles({
    feedId: userFeed.id,
    data: {
      limit: 1,
      skip: 0,
      selectProperties: ["*"],
      formatOptions: articleFormatOptions,
      filters: {
        articleId: selectedArticleId,
      },
      random: !selectedArticleId,
    },
  });
  const { createErrorAlert } = usePageAlertContext();

  const { alertComponent } = useGetUserFeedArticlesError({
    getUserFeedArticlesStatus: userFeedArticlesStatus,
    getUserFeedArticlesError: error,
    getUserFeedArticlesOutput: userFeedArticles,
  });

  const firstArticle = userFeedArticles?.result.articles[0];

  const { t } = useTranslation();

  const onClickRandomFeedArticle = async () => {
    try {
      setSelectedArticleId(undefined);
      await refetchUserFeedArticle();
    } catch (err) {
      createErrorAlert({
        title: "Failed to fetch random article.",
        description: (err as Error).message,
      });
    }
  };

  const onSelectedArticle = async (articleId: string) => {
    setSelectedArticleId(articleId);
  };

  const firstArticleTitle = (firstArticle as Record<string, string>)?.title;
  const firstArticleDate = (firstArticle as Record<string, string>)?.date;

  const onClickExpand = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen();
  };

  const accordionPanelContent = (
    <Stack flex={1}>
      <Stack bg="bg.subtle" position="sticky" top={0} zIndex={10} pt={4}>
        <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
          <InputGroup
            maxWidth={["100%", "100%", "400px"]}
            startElement={<Icon as={FaMagnifyingGlass} color="fg.subtle" />}
          >
            <Input
              disabled={userFeedArticlesFetchStatus === "fetching"}
              placeholder={t(
                "features.feedConnections.components.articlePlaceholderTable.searchInputPlaceholder",
              )}
              onChange={(e) => setPlaceholderTableSearch(e.target.value.toLowerCase())}
            />
          </InputGroup>
          <Checkbox onCheckedChange={(e) => setHideEmptyPlaceholders(!!e.checked)}>
            <Text whiteSpace="nowrap">
              {t(
                "features.feedConnections.components.articlePlaceholderTable.hideEmptyPlaceholdersLabel",
              )}
            </Text>
          </Checkbox>
        </HStack>
        <Separator />
      </Stack>
      <Stack>
        {userFeedArticlesStatus === "loading" && (
          <Stack alignItems="center">
            <Spinner size="xl" />
            <Text>
              {t("features.feedConnections.components.articlePlaceholderTable.loadingArticle")}
            </Text>
          </Stack>
        )}
        {!alertComponent && firstArticle && (
          <ArticlePlaceholderTable
            asPlaceholders
            article={userFeedArticles.result.articles[0]}
            searchText={placeholderTableSearch}
            hideEmptyPlaceholders={hideEmptyPlaceholders}
            isFetching={userFeedArticlesFetchStatus === "fetching"}
          />
        )}
      </Stack>
    </Stack>
  );

  return (
    <Stack gap={12}>
      <DialogRoot
        open={isOpen}
        onOpenChange={(e) => setIsOpen(e.open)}
        size="full"
        scrollBehavior="inside"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Placeholders</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody as={Stack} paddingTop={0}>
            <Stack flex={1} pb={4} pl={4} pr={4}>
              {accordionPanelContent}
            </Stack>
          </DialogBody>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
      <Stack>
        <Heading size="md" as="h2">
          Message Format
        </Heading>
        <Text>Customize how your feed&apos;s articles are displayed in your Discord messages.</Text>
      </Stack>
      <Alert.Root
        role={undefined}
        flexDirection="column"
        alignItems="flex-start"
        overflow="visible"
        colorPalette="brand"
      >
        <Stack gap={4}>
          <Stack gap={2}>
            <HStack>
              <Badge colorPalette="green">NEW!</Badge>
              <Alert.Title display="block">Try the Message Builder with Components V2!</Alert.Title>
            </HStack>
            <Alert.Description display="block">
              Design and preview your Discord messages with the Message Builder. Now with Components
              V2 support for richer layouts including containers, media galleries, sections with
              thumbnails, and more.
            </Alert.Description>
            {hasComponentsV2 && (
              <Text fontSize="sm" color="text.link" mt={2}>
                This connection has been configured using Components V2 in the Message Builder
                already. The legacy message form has been hidden because it is only compatible with
                Components V1.
              </Text>
            )}
          </Stack>
          <Box>
            <PrimaryActionButton asChild>
              <Link
                to={pages.messageBuilder({
                  feedId: userFeed.id,
                  connectionId: connection.id,
                  connectionType: connection.key,
                  scope,
                })}
              >
                <span>{hasComponentsV2 ? "Open Message Builder" : "Check it out"}</span>
                <FaChevronRight />
              </Link>
            </PrimaryActionButton>
          </Box>
        </Stack>
      </Alert.Root>
      {!hasComponentsV2 && (
        <>
          <Stack gap={4} as="aside" aria-labelledby="placeholders-title">
            <Stack>
              <Heading as="h3" size="sm" id="placeholders-title">
                Article Placeholders Reference
              </Heading>
              <Text>
                Customize your message format with the use of placeholders by copying their names
                and pasting them into any part of your message format for them to be replaced with
                the their corresponding article content.
              </Text>
            </Stack>
            {alertComponent}
            {userFeedArticlesStatus === "loading" && (
              <Center mt={6}>
                <Spinner />
              </Center>
            )}
            {!alertComponent && firstArticle && (
              <Card.Root size="md" overflow="auto">
                <Card.Header padding={0} margin={5}>
                  <Heading size="xs" as="h4" textTransform="uppercase">
                    Selected Article
                  </Heading>
                </Card.Header>
                <Card.Body padding={0} margin={5} mt={0}>
                  <Stack gap={4}>
                    <HStack justifyContent="space-between" flexWrap="wrap">
                      <Box>
                        {firstArticleDate && <Text color="fg.muted">{firstArticleDate}</Text>}
                        <Text textStyle="md" fontWeight="semibold">
                          {firstArticleTitle || (
                            <Text as="span" color="fg.muted">
                              (no title available)
                            </Text>
                          )}
                        </Text>
                      </Box>
                      <HStack alignItems="center" flexWrap="wrap">
                        <ArticleSelectDialog
                          articleFormatOptions={articleFormatOptions}
                          trigger={
                            <SafeLoadingButton
                              loading={
                                !!selectedArticleId && userFeedArticlesFetchStatus === "fetching"
                              }
                              aria-disabled={userFeedArticlesFetchStatus === "fetching"}
                            >
                              <FiMousePointer />
                              <span>
                                {t(
                                  "features.feedConnections.components.articlePlaceholderTable.selectArticle",
                                )}
                              </span>
                            </SafeLoadingButton>
                          }
                          feedId={userFeed.id}
                          onArticleSelected={onSelectedArticle}
                          onClickRandomArticle={onClickRandomFeedArticle}
                        />
                        <SafeLoadingButton
                          loading={!selectedArticleId && userFeedArticlesFetchStatus === "fetching"}
                          aria-disabled={userFeedArticlesFetchStatus === "fetching"}
                          onClick={() => {
                            if (userFeedArticlesFetchStatus === "fetching") {
                              return;
                            }

                            onClickRandomFeedArticle();
                          }}
                        >
                          <FaArrowsRotate />
                          <span>
                            {t(
                              "features.feedConnections.components.articlePlaceholderTable.randomButton",
                            )}
                          </span>
                        </SafeLoadingButton>
                      </HStack>
                    </HStack>
                    <AccordionRoot collapsible>
                      <AccordionItem value="placeholders" borderBottomWidth="0" alignItems="center">
                        <AccordionItemTrigger
                          fontSize="sm"
                          fontWeight={600}
                          minHeight="50px"
                          color="text.link"
                          indicatorPlacement="start"
                          borderBottomWidth={{ base: "0px", _open: "1px" }}
                          borderColor="border"
                        >
                          <HStack justifyContent="space-between" width="100%">
                            <Text>View Placeholders</Text>
                            <IconButton
                              aria-label="Open dialog listing all placeholders" // adding just to satisfy lint
                              variant="ghost"
                              size="sm"
                              color="text.link"
                              onClick={onClickExpand}
                            >
                              <FaExpandAlt />
                            </IconButton>
                          </HStack>
                        </AccordionItemTrigger>
                        <AccordionItemContent maxHeight="sm" overflow="auto" paddingTop={0}>
                          {accordionPanelContent}
                          <Center mt={4}>
                            <Text fontSize="sm" color="fg.muted">
                              Don&apos;t see the content that you need? You can transform
                              placeholder content through{" "}
                              <ChakraLink asChild color="text.link">
                                <Link
                                  to={pages.userFeedConnection(
                                    {
                                      feedId: userFeed.id,
                                      connectionId: connection.id,
                                      connectionType: connection.key,
                                      scope,
                                    },
                                    {
                                      tab: UserFeedConnectionTabSearchParam.CustomPlaceholders,
                                    },
                                  )}
                                >
                                  Custom Placeholders
                                </Link>
                              </ChakraLink>
                              , or get additional ones with{" "}
                              <ChakraLink asChild color="text.link">
                                <Link
                                  to={pages.userFeed(userFeed.id, {
                                    tab: UserFeedTabSearchParam.ExternalProperties,
                                    scope,
                                  })}
                                >
                                  External Properties
                                </Link>
                              </ChakraLink>
                              .
                            </Text>
                          </Center>
                        </AccordionItemContent>
                      </AccordionItem>
                    </AccordionRoot>
                  </Stack>
                </Card.Body>
              </Card.Root>
            )}
          </Stack>
          <DiscordMessageForm
            onClickSave={onMessageUpdated}
            articleIdToPreview={firstArticle?.id}
            guildId={guildId}
          />
        </>
      )}
    </Stack>
  );
};
