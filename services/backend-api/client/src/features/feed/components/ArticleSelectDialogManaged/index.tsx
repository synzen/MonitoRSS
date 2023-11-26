import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  HStack,
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
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RepeatIcon, SearchIcon } from "@chakra-ui/icons";
import { Loading, Menu, ThemedSelect } from "@/components";
import { GetArticlesFilterReturnType } from "../../constants";
import {
  useUserFeedArticleProperties,
  useUserFeedArticles,
  useUserFeedArticlesWithPagination,
} from "../../hooks";
import getChakraColor from "../../../../utils/getChakraColor";
import { GetUserFeedArticlesInput } from "../../api";
import { useDebounce } from "../../../../hooks";

interface Props {
  feedId: string;
  trigger: React.ReactElement;
  onClickRandomArticle: () => void;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

export const ArticleSelectDialog = ({
  feedId,
  trigger,
  onClickRandomArticle,
  articleFormatter,
}: Props) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { t } = useTranslation();
  const [selectedArticleProperty, setSelectedArticleProperty] = useState<string | undefined>(
    "title"
  );
  const [search, setSearch] = useState("");
  const { data: feedArticlePropertiesResult, status: feedArticlePropertiesStatus } =
    useUserFeedArticleProperties({
      feedId,
      data: {
        customPlaceholders: articleFormatter.customPlaceholders,
      },
    });
  const debouncedSearch = useDebounce(search, 500);
  const {
    data: userFeedArticlesResults,
    status: userFeedArticlesStatus,
    error,
    fetchStatus,
    nextPage,
    prevPage,
    skip,
    limit,
    refetch,
  } = useUserFeedArticlesWithPagination({
    feedId,
    data: {
      selectProperties: selectedArticleProperty
        ? [selectedArticleProperty, "id"]
        : ([
            feedArticlePropertiesResult?.result.properties.find((p) => p === "title") ||
              feedArticlePropertiesResult?.result.properties[0],
          ]
            .concat(["id"])
            .filter((i) => i) as string[]),
      filters: {
        returnType: GetArticlesFilterReturnType.IncludeEvaluationResults,
        search: debouncedSearch,
      },
      formatter: articleFormatter,
    },
  });
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
  const {
    data: dataUserFeedArticles,
    refetch: refetchUserFeedArticles,
    fetchStatus: fetchStatusUserFeedArticles,
    status: statusUserFeedArticles,
  } = useUserFeedArticles({
    feedId,
    disabled: !selectedArticleId,
    data: {
      limit: 1,
      skip: 0,
      selectProperties: ["*"],
      formatter: articleFormatter,
      filters: {
        articleId: selectedArticleId,
      },
    },
  });

  const onChangeFeedArticleProperty = (value: string) => {
    setSelectedArticleProperty(value);
  };

  const onClickArticle = async (articleId?: string) => {
    if (articleId) {
      setSelectedArticleId(articleId);
    } else {
      onClickRandomArticle();
    }

    onClose();
  };

  const useArticleProperty =
    selectedArticleProperty || userFeedArticlesResults?.result.selectedProperties[0];
  const articles = userFeedArticlesResults?.result.articles;
  const totalArticles = userFeedArticlesResults?.result.totalArticles;
  const onFirstPage = skip === 0;
  const onLastPage = !totalArticles || skip + limit >= totalArticles;

  return (
    <>
      {React.cloneElement(trigger, {
        onClick: onOpen,
      })}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("features.userFeeds.components.articleSelectPrompt.title")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              {/* <Divider /> */}
              <Box>
                {userFeedArticlesStatus === "loading" && (
                  <Stack>
                    <Center>
                      <Loading />
                    </Center>
                    <Center>
                      <Text color="gray.300">
                        {t("features.userFeeds.components.articleSelectPrompt.loadingArticles")}
                      </Text>
                    </Center>
                  </Stack>
                )}
                {error && (
                  <Alert status="error" title={t("common.errors.somethingWentWrong")}>
                    <AlertIcon />
                    {error.message}
                  </Alert>
                )}
                {articles && (
                  <Stack>
                    <Flex>
                      <HStack alignItems="center" flexGrow={1} flexWrap="wrap">
                        <Text whiteSpace="nowrap">Property:</Text>
                        <Box flexGrow={1}>
                          <ThemedSelect
                            options={
                              feedArticlePropertiesResult?.result.properties.map((property) => ({
                                value: property,
                                label: property,
                                data: property,
                              })) || []
                            }
                            isDisabled={feedArticlePropertiesStatus === "loading"}
                            loading={feedArticlePropertiesStatus === "loading"}
                            value={useArticleProperty}
                            onChange={onChangeFeedArticleProperty}
                          />
                        </Box>
                        {/* <IconButton
                          aria-label="Reload"
                          icon={<RepeatIcon />}
                          isLoading={fetchStatus === "fetching"}
                          onClick={() => refetch()}
                        /> */}
                        <Button
                          leftIcon={<RepeatIcon />}
                          isLoading={fetchStatus === "fetching"}
                          onClick={() => refetch()}
                        >
                          Reload
                        </Button>
                      </HStack>
                    </Flex>
                    <Stack>
                      <InputGroup>
                        <InputLeftElement pointerEvents="none">
                          <SearchIcon color="gray.300" />
                        </InputLeftElement>
                        <Input
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search..."
                        />
                      </InputGroup>
                    </Stack>
                    <Stack spacing={8} position="relative" rounded="lg">
                      {fetchStatus === "fetching" && (
                        <Flex
                          bg="blackAlpha.700"
                          position="absolute"
                          height="100%"
                          width="100%"
                          rounded="lg"
                          justifyContent="center"
                          alignItems="center"
                        >
                          <Spinner />
                        </Flex>
                      )}
                      <Stack spacing={4} bg="gray.700" rounded="lg">
                        <Box
                          overflow="auto"
                          height="100%"
                          maxHeight={400}
                          border={`solid 2px ${getChakraColor("gray.600")}`}
                          borderRadius="lg"
                        >
                          <Menu
                            items={articles.map((article) => ({
                              id: article.id,
                              title: article[useArticleProperty as never] || (
                                <Text color="gray.400">unknown</Text>
                              ),
                              value: article.id,
                              description: "",
                            }))}
                            boxProps={{
                              background: "transparent",
                              // border: `solid 2px ${getChakraColor("gray.600")}`,
                            }}
                            onSelectedValue={onClickArticle}
                            shown
                          />
                        </Box>
                      </Stack>
                    </Stack>
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text as="sub">
                        {t("common.table.results", {
                          start: skip + 1,
                          end: skip + limit,
                          total: totalArticles,
                        })}
                      </Text>
                      <HStack>
                        <Button
                          width="min-content"
                          size="sm"
                          onClick={prevPage}
                          isDisabled={onFirstPage || fetchStatus === "fetching"}
                        >
                          {t("features.feedConnections.components.filtersTabSection.prevPage")}
                        </Button>
                        <Button
                          size="sm"
                          width="min-content"
                          onClick={nextPage}
                          isDisabled={onLastPage || fetchStatus === "fetching"}
                        >
                          {t("features.feedConnections.components.filtersTabSection.nextPage")}
                        </Button>
                      </HStack>
                    </Flex>
                  </Stack>
                )}
              </Box>
              <Alert borderRadius="md">
                <AlertDescription>
                  <Text fontSize="sm">
                    {t("features.userFeeds.components.articleSelectPrompt.mayBeDelayWarning")}
                  </Text>
                </AlertDescription>
              </Alert>
              <Divider />
              <Button onClick={() => onClickArticle()} leftIcon={<RepeatIcon />}>
                {t("features.userFeeds.components.articleSelectPrompt.selectRandom")}
              </Button>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>
              {t("common.buttons.close")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
