import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RepeatIcon } from "@chakra-ui/icons";
import { Loading, Menu, ThemedSelect } from "@/components";
import { GetArticlesFilterReturnType } from "../../constants";
import { useUserFeedArticleProperties, useUserFeedArticlesWithPagination } from "../../hooks";
import getChakraColor from "../../../../utils/getChakraColor";
import { GetUserFeedArticlesInput } from "../../api";

interface Props {
  feedId: string;
  trigger: React.ReactElement;
  onArticleSelected: (articleId: string) => void;
  onClickRandomArticle: () => void;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

export const ArticleSelectPrompt = ({
  feedId,
  trigger,
  onArticleSelected,
  onClickRandomArticle,
  articleFormatter,
}: Props) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { t } = useTranslation();
  const [selectedArticleProperty, setSelectedArticleProperty] = useState<string | undefined>(
    undefined
  );
  const { data: feedArticlePropertiesResult, status: feedArticlePropertiesStatus } =
    useUserFeedArticleProperties({ feedId });
  const {
    data: userFeedArticlesResults,
    status: userFeedArticlesStatus,
    error,
    fetchStatus,
    nextPage,
    prevPage,
    skip,
    limit,
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
      },
      formatter: articleFormatter,
    },
  });

  const onChangeFeedArticleProperty = (value: string) => {
    setSelectedArticleProperty(value);
  };

  const onClickArticle = async (articleId?: string) => {
    if (articleId) {
      onArticleSelected(articleId);
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
      <Modal isOpen={isOpen} onClose={onClose}>
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
                      <HStack alignItems="center" flexGrow={1}>
                        <Text whiteSpace="nowrap">
                          {t(
                            "features.feedConnections.components" +
                              ".filtersTabSection.displayPropertyDropdownLabel"
                          )}
                        </Text>
                        <Box flexGrow={1}>
                          <ThemedSelect
                            options={
                              feedArticlePropertiesResult?.result.properties.map((property) => ({
                                value: property,
                                label: property,
                              })) || []
                            }
                            isDisabled={feedArticlePropertiesStatus === "loading"}
                            loading={feedArticlePropertiesStatus === "loading"}
                            value={useArticleProperty}
                            onChange={onChangeFeedArticleProperty}
                          />
                        </Box>
                      </HStack>
                    </Flex>
                    <Stack spacing={8}>
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
