import { RepeatIcon, SearchIcon } from "@chakra-ui/icons";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Center,
  Checkbox,
  Divider,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiMousePointer } from "react-icons/fi";
import { useState } from "react";
import { FaExpandAlt } from "react-icons/fa";
import { Link } from "react-router-dom";
import { DiscordMessageFormData } from "../../../../types/discord";
import { notifyError } from "../../../../utils/notifyError";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { useUserFeed, useUserFeedArticles } from "../../../feed/hooks";
import { UserFeedArticleRequestStatus } from "../../../feed/types";
import { getErrorMessageForArticleRequestStatus } from "../../../feed/utils";
import { ArticlePlaceholderTable } from "../ArticlePlaceholderTable";
import { FeedConnectionType } from "../../../../types";
import { DiscordMessageForm } from "../DiscordMessageForm";
import { ArticleSelectDialog } from "../../../feed/components";
import getChakraColor from "../../../../utils/getChakraColor";
import { pages } from "../../../../constants";
import { UserFeedConnectionTabSearchParam } from "../../../../constants/userFeedConnectionTabSearchParam";
import { UserFeedTabSearchParam } from "../../../../constants/userFeedTabSearchParam";

interface Props {
  feedId: string;
  defaultMessageValues?: DiscordMessageFormData;
  onMessageUpdated: (data: DiscordMessageFormData) => Promise<void>;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
  connection: {
    id: string;
    type: FeedConnectionType;
  };
  include?: {
    forumForms?: boolean;
  };
  guildId: string | undefined;
}

export const MessageTabSection = ({
  feedId,
  defaultMessageValues,
  onMessageUpdated,
  articleFormatter,
  connection,
  include,
  guildId,
}: Props) => {
  const { feed } = useUserFeed({
    feedId,
  });
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
  const [placeholderTableSearch, setPlaceholderTableSearch] = useState<string>("");
  const [hideEmptyPlaceholders, setHideEmptyPlaceholders] = useState<boolean>(false);
  const {
    data: userFeedArticles,
    refetch: refetchUserFeedArticle,
    fetchStatus: userFeedArticlesFetchStatus,
    status: userFeedArticlesStatus,
  } = useUserFeedArticles({
    feedId,
    data: {
      limit: 1,
      skip: 0,
      selectProperties: ["*"],
      formatter: {
        ...articleFormatter,
        externalProperties: feed?.externalProperties,
      },
      filters: {
        articleId: selectedArticleId,
      },
      random: !selectedArticleId,
    },
    disabled: !feed,
  });

  const firstArticle = userFeedArticles?.result.articles[0];
  const requestStatus = userFeedArticles?.result.requestStatus;

  const { t } = useTranslation();

  const onClickRandomFeedArticle = async () => {
    try {
      setSelectedArticleId(undefined);
      await refetchUserFeedArticle();
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const onSelectedArticle = async (articleId: string) => {
    setSelectedArticleId(articleId);
  };

  const fetchErrorAlert = userFeedArticlesStatus === "error" && (
    <Alert status="error">
      <AlertIcon />
      {t("common.errors.somethingWentWrong")}
    </Alert>
  );

  const alertStatus =
    requestStatus && requestStatus !== UserFeedArticleRequestStatus.Success
      ? getErrorMessageForArticleRequestStatus(
          requestStatus,
          userFeedArticles?.result?.response?.statusCode
        )
      : null;

  const parseErrorAlert = alertStatus && (
    <Alert status={alertStatus.status || "error"}>
      <AlertIcon />
      {t(alertStatus.ref)}
    </Alert>
  );

  const noArticlesAlert = userFeedArticles?.result.articles.length === 0 && (
    <Alert status="info">
      <AlertIcon />
      {t("features.feedConnections.components.articlePlaceholderTable.noArticles")}
    </Alert>
  );

  const hasAlert = !!(fetchErrorAlert || parseErrorAlert || noArticlesAlert);

  const firstArticleTitle = (firstArticle as Record<string, string>)?.title;
  const firstArticleDate = (firstArticle as Record<string, string>)?.date;

  const onClickExpand = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen();
  };

  const accordionPanelContent = (
    <Stack flex={1}>
      <Stack bg="gray.800" position="sticky" top={0} zIndex={10} pt={4}>
        <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
          <InputGroup maxWidth={["100%", "100%", "400px"]}>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input
              isDisabled={userFeedArticlesFetchStatus === "fetching"}
              placeholder={t(
                "features.feedConnections.components.articlePlaceholderTable.searchInputPlaceholder"
              )}
              onChange={(e) => setPlaceholderTableSearch(e.target.value.toLowerCase())}
            />
          </InputGroup>
          <Checkbox onChange={(e) => setHideEmptyPlaceholders(e.target.checked)}>
            <Text whiteSpace="nowrap">
              {t(
                "features.feedConnections.components.articlePlaceholderTable.hideEmptyPlaceholdersLabel"
              )}
            </Text>
          </Checkbox>
        </HStack>
        <Divider />
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
        {!hasAlert && firstArticle && (
          <ArticlePlaceholderTable
            asPlaceholders
            article={userFeedArticles.result.articles[0]}
            searchText={placeholderTableSearch}
            hideEmptyPlaceholders={hideEmptyPlaceholders}
            isFetching={userFeedArticlesFetchStatus === "fetching"}
            withoutCopy
          />
        )}
      </Stack>
    </Stack>
  );

  return (
    <Stack spacing={24}>
      <Modal isOpen={isOpen} onClose={onClose} size="full" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Placeholders</ModalHeader>
          <ModalCloseButton />
          <ModalBody as={Stack} paddingTop={0}>
            <Stack bg="gray.800" flex={1} borderRadius="md" pb={4} pl={4} pr={4}>
              {accordionPanelContent}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Stack spacing={4}>
        <Stack>
          <Heading as="h2" size="md">
            {t(
              "features.feedConnections.components." +
                "articlePlaceholderTable.headingSamplePlaceholders"
            )}
          </Heading>
          <Text>
            Placeholders can be used to inject article content into your messages. View any
            article&apos;s placeholders below.
          </Text>
        </Stack>
        {fetchErrorAlert || parseErrorAlert || noArticlesAlert}
        {userFeedArticlesStatus === "loading" && (
          <Center mt={6}>
            <Spinner />
          </Center>
        )}
        {!hasAlert && firstArticle && (
          <Card size="md">
            <CardHeader padding={0} margin={5}>
              <Heading size="xs" textTransform="uppercase">
                Selected Article
              </Heading>
            </CardHeader>
            <CardBody padding={0} margin={5} mt={0}>
              <Stack spacing={4}>
                <HStack justifyContent="space-between" flexWrap="wrap">
                  <Box>
                    {firstArticleDate && <Text color="gray.400">{firstArticleDate}</Text>}
                    <Heading size="md">
                      {firstArticleTitle || (
                        <span
                          style={{
                            color: `${getChakraColor("gray.400")}`,
                          }}
                        >
                          (no title available)
                        </span>
                      )}
                    </Heading>
                  </Box>
                  <HStack alignItems="center" flexWrap="wrap">
                    <ArticleSelectDialog
                      trigger={
                        <Button
                          leftIcon={<FiMousePointer />}
                          isLoading={
                            !!selectedArticleId && userFeedArticlesFetchStatus === "fetching"
                          }
                          isDisabled={userFeedArticlesFetchStatus === "fetching"}
                        >
                          <span>
                            {t(
                              "features.feedConnections.components.articlePlaceholderTable.selectArticle"
                            )}
                          </span>
                        </Button>
                      }
                      feedId={feedId}
                      articleFormatter={articleFormatter}
                      onArticleSelected={onSelectedArticle}
                      onClickRandomArticle={onClickRandomFeedArticle}
                    />
                    <Button
                      leftIcon={<RepeatIcon />}
                      isLoading={!selectedArticleId && userFeedArticlesFetchStatus === "fetching"}
                      isDisabled={userFeedArticlesFetchStatus === "fetching"}
                      onClick={onClickRandomFeedArticle}
                    >
                      <span>
                        {t(
                          "features.feedConnections.components.articlePlaceholderTable.randomButton"
                        )}
                      </span>
                    </Button>
                  </HStack>
                </HStack>
                <Accordion allowToggle borderRadius="md">
                  <AccordionItem bg="gray.800" borderRadius="md" alignItems="center">
                    <AccordionButton
                      fontSize="sm"
                      fontWeight={600}
                      minHeight="50px"
                      color="blue.300"
                    >
                      <HStack justifyContent="space-between" width="100%">
                        <HStack spacing={2}>
                          <Text>View Placeholders</Text>
                          <AccordionIcon />
                        </HStack>
                        <IconButton
                          icon={<FaExpandAlt />}
                          aria-label="Show bigger"
                          variant="ghost"
                          size="sm"
                          color="blue.300"
                          onClick={onClickExpand}
                        />
                      </HStack>
                    </AccordionButton>
                    <AccordionPanel
                      bg="gray.800"
                      borderRadius="md"
                      maxHeight="sm"
                      overflow="auto"
                      paddingTop={0}
                      mt={-4}
                    >
                      {accordionPanelContent}
                      <Center mt={4}>
                        <Text fontSize="sm" color="whiteAlpha.600">
                          Don&apos;t see the content that you need? You can transform placeholder
                          content through{" "}
                          <ChakraLink
                            as={Link}
                            color="blue.400"
                            to={pages.userFeedConnection(
                              {
                                feedId: feed?.id as string,
                                connectionId: connection.id,
                                connectionType: connection.type,
                              },
                              {
                                tab: UserFeedConnectionTabSearchParam.CustomPlaceholders,
                              }
                            )}
                          >
                            Custom Placeholders
                          </ChakraLink>
                          , or get additional ones with{" "}
                          <ChakraLink
                            color="blue.400"
                            as={Link}
                            to={pages.userFeed(feed?.id as string, {
                              tab: UserFeedTabSearchParam.ExternalProperties,
                            })}
                          >
                            External Properties
                          </ChakraLink>
                          .
                        </Text>
                      </Center>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </Stack>
            </CardBody>
          </Card>
        )}
      </Stack>
      <DiscordMessageForm
        onClickSave={onMessageUpdated}
        defaultValues={defaultMessageValues}
        connection={connection}
        feedId={feedId}
        articleIdToPreview={firstArticle?.id}
        include={include}
        guildId={guildId}
      />
    </Stack>
  );
};
