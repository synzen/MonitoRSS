import { ChevronRightIcon, RepeatIcon, SearchIcon } from "@chakra-ui/icons";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiMousePointer } from "react-icons/fi";
import { useState } from "react";
import { FaExpandAlt } from "react-icons/fa";
import { Link } from "react-router-dom";
import { DiscordMessageFormData } from "../../../../types/discord";
import { useUserFeedArticles } from "../../../feed/hooks";
import { ArticlePlaceholderTable } from "../ArticlePlaceholderTable";
import { DiscordMessageForm } from "../DiscordMessageForm";
import { ArticleSelectDialog } from "../../../feed/components";
import getChakraColor from "../../../../utils/getChakraColor";
import { pages } from "../../../../constants";
import { UserFeedConnectionTabSearchParam } from "../../../../constants/userFeedConnectionTabSearchParam";
import { UserFeedTabSearchParam } from "../../../../constants/userFeedTabSearchParam";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";
import { useGetUserFeedArticlesError } from "../../hooks";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { FeedDiscordChannelConnection } from "../../../../types";

interface Props {
  onMessageUpdated: (data: DiscordMessageFormData) => Promise<void>;
  guildId: string | undefined;
}

export const MessageTabSection = ({ onMessageUpdated, guildId }: Props) => {
  const { userFeed, connection, articleFormatOptions } =
    useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { isOpen, onClose, onOpen } = useDisclosure();
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
    <Stack spacing={12}>
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
      <Stack>
        <Heading size="md" as="h2">
          Message Format
        </Heading>
        <Text>Customize how your feed&apos;s articles are displayed in your Discord messages.</Text>
      </Stack>
      <Alert
        role={undefined}
        flexDirection="column"
        alignItems="flex-start"
        borderRadius="md"
        overflow="visible"
        colorScheme="blue"
      >
        <Stack spacing={4}>
          <Stack spacing={2}>
            <HStack>
              <Badge colorScheme="green">NEW!</Badge>
              <AlertTitle display="block">Try the Message Builder with Components V2!</AlertTitle>
            </HStack>
            <AlertDescription display="block">
              Design and preview your Discord messages with the Message Builder. Now with Components
              V2 support for richer layouts including containers, media galleries, sections with
              thumbnails, and more.
            </AlertDescription>
            {hasComponentsV2 && (
              <Text fontSize="sm" color="blue.200" mt={2}>
                This connection has been configured using Components V2 in the Message Builder
                already. The legacy message form has been hidden because it is only compatible with
                Components V1.
              </Text>
            )}
          </Stack>
          <Box>
            <Button
              as={Link}
              to={pages.messageBuilder({
                feedId: userFeed.id,
                connectionId: connection.id,
                connectionType: connection.key,
              })}
              rightIcon={<ChevronRightIcon />}
            >
              {hasComponentsV2 ? "Open Message Builder" : "Check it out"}
            </Button>
          </Box>
        </Stack>
      </Alert>
      {!hasComponentsV2 && (
        <>
          <Stack spacing={4} as="aside" aria-labelledby="placeholders-title">
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
              <Card size="md" overflow="auto">
                <CardHeader padding={0} margin={5}>
                  <Heading size="xs" as="h4" textTransform="uppercase">
                    Selected Article
                  </Heading>
                </CardHeader>
                <CardBody padding={0} margin={5} mt={0}>
                  <Stack spacing={4}>
                    <HStack justifyContent="space-between" flexWrap="wrap">
                      <Box>
                        {firstArticleDate && <Text color="gray.400">{firstArticleDate}</Text>}
                        <Text size="md" fontWeight="semibold">
                          {firstArticleTitle || (
                            <span
                              style={{
                                color: `${getChakraColor("gray.400")}`,
                              }}
                            >
                              (no title available)
                            </span>
                          )}
                        </Text>
                      </Box>
                      <HStack alignItems="center" flexWrap="wrap">
                        <ArticleSelectDialog
                          articleFormatOptions={articleFormatOptions}
                          trigger={
                            <Button
                              leftIcon={<FiMousePointer />}
                              isLoading={
                                !!selectedArticleId && userFeedArticlesFetchStatus === "fetching"
                              }
                              aria-disabled={userFeedArticlesFetchStatus === "fetching"}
                            >
                              <span>
                                {t(
                                  "features.feedConnections.components.articlePlaceholderTable.selectArticle"
                                )}
                              </span>
                            </Button>
                          }
                          feedId={userFeed.id}
                          onArticleSelected={onSelectedArticle}
                          onClickRandomArticle={onClickRandomFeedArticle}
                        />
                        <Button
                          leftIcon={<RepeatIcon />}
                          isLoading={
                            !selectedArticleId && userFeedArticlesFetchStatus === "fetching"
                          }
                          aria-disabled={userFeedArticlesFetchStatus === "fetching"}
                          onClick={() => {
                            if (userFeedArticlesFetchStatus === "fetching") {
                              return;
                            }

                            onClickRandomFeedArticle();
                          }}
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
                              aria-label="Open dialog listing all placeholders" // adding just to satisfy lint
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
                              Don&apos;t see the content that you need? You can transform
                              placeholder content through{" "}
                              <ChakraLink
                                as={Link}
                                color="blue.400"
                                to={pages.userFeedConnection(
                                  {
                                    feedId: userFeed.id,
                                    connectionId: connection.id,
                                    connectionType: connection.key,
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
                                to={pages.userFeed(userFeed.id, {
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
            articleIdToPreview={firstArticle?.id}
            guildId={guildId}
          />
        </>
      )}
    </Stack>
  );
};
