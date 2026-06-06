import {
  Alert,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Input,
  InputGroup,
  Separator,
  Spinner,
  Stack,
  Text,
  chakra,
  Field as ChakraField,
} from "@chakra-ui/react";
import React, { ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaArrowsRotate, FaMagnifyingGlass } from "react-icons/fa6";
import { Loading, Menu, Panel, ThemedSelect } from "@/components";
import { useUserFeedArticleProperties, useUserFeedArticlesWithPagination } from "../../hooks";
import { useDebounce } from "../../../../hooks";
import { useGetUserFeedArticlesError } from "@/features/feedConnections";
import { DiscordFormatOptions } from "@/types/discord/DiscordFormatOptions";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

interface Props {
  feedId: string;
  trigger: React.ReactElement;
  onArticleSelected: (articleId: string) => void;
  onClickRandomArticle?: () => void;
  singleProperty?: string;
  articleFormatOptions: DiscordFormatOptions;
}

export const ArticleSelectDialog = ({
  feedId,
  trigger,
  onArticleSelected,
  onClickRandomArticle,
  singleProperty,
  articleFormatOptions,
}: Props) => {
  const [open, setOpen] = useState(false);
  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);
  const { t } = useTranslation();
  const [selectedArticleProperty, setSelectedArticleProperty] = useState<string | undefined>(
    singleProperty || "title",
  );
  const [search, setSearch] = useState("");
  const { data: feedArticlePropertiesResult, status: feedArticlePropertiesStatus } =
    useUserFeedArticleProperties({
      feedId,
      data: {
        customPlaceholders: articleFormatOptions.customPlaceholders,
      },
      isDisabled: !open,
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
    isDisabled: !open,
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
      filters: debouncedSearch
        ? {
            search: debouncedSearch,
          }
        : undefined,
      formatOptions: articleFormatOptions,
    },
  });
  const { alertComponent } = useGetUserFeedArticlesError({
    getUserFeedArticlesStatus: userFeedArticlesStatus,
    getUserFeedArticlesError: error,
    getUserFeedArticlesOutput: userFeedArticlesResults,
  });

  const onChangeFeedArticleProperty = (value: string) => {
    setSelectedArticleProperty(value);
  };

  const onClickArticle = async (articleId?: string) => {
    if (articleId) {
      onArticleSelected(articleId);
    } else if (onClickRandomArticle) {
      onClickRandomArticle();
    }

    onClose();
  };

  useEffect(() => {
    if (singleProperty) {
      setSelectedArticleProperty(singleProperty);
    }
  }, [singleProperty]);

  const useArticleProperty =
    selectedArticleProperty || userFeedArticlesResults?.result.selectedProperties[0];
  const articles = userFeedArticlesResults?.result.articles;
  const totalArticles = userFeedArticlesResults?.result.totalArticles;
  const onFirstPage = skip === 0;
  const onLastPage = !totalArticles || skip + limit >= totalArticles;

  return (
    <>
      {React.cloneElement(trigger, {
        onClick: () => {
          if (trigger.props["aria-disabled"]) {
            return;
          }

          onOpen();
        },
      })}
      <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)} size="xl">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("features.userFeeds.components.articleSelectPrompt.title")}
            </DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <Box aria-live="polite" srOnly>
              {userFeedArticlesStatus === "loading" && (
                <span>
                  Loading articles ${skip + 1} through ${skip + limit}
                </span>
              )}
              {userFeedArticlesStatus === "success" && (
                <span>
                  Finished loading articles ${skip + 1} through ${Math.max(skip + limit)}
                </span>
              )}
              {userFeedArticlesStatus === "success" && fetchStatus === "fetching" && (
                <span>
                  Loading articles ${skip + 1} through ${skip + limit}
                </span>
              )}
            </Box>
            <Stack gap={4}>
              <Box>
                {userFeedArticlesStatus === "loading" && (
                  <Stack aria-hidden>
                    <Center>
                      <Loading />
                    </Center>
                    <Center>
                      <Text color="fg.subtle">
                        {t("features.userFeeds.components.articleSelectPrompt.loadingArticles")}
                      </Text>
                    </Center>
                  </Stack>
                )}
                {alertComponent}
                {articles && (
                  <Stack>
                    <Flex>
                      <HStack alignItems="center" flexGrow={1} flexWrap="wrap">
                        <ChakraField.Root flexGrow={1}>
                          <ChakraField.Label
                            id="article-select-dialog-property-label"
                            htmlFor="article-select-dialog-property-select"
                          >
                            Article Property
                          </ChakraField.Label>
                          {/* {!singleProperty && ( */}
                          <ThemedSelect
                            isInvalid={false}
                            selectProps={{
                              inputId: "article-select-dialog-property-select",
                              "aria-labelledby": "article-select-dialog-property-label",
                            }}
                            options={
                              feedArticlePropertiesResult?.result.properties.map((property) => ({
                                value: property,
                                label: property,
                                data: property,
                              })) || []
                            }
                            isDisabled={
                              feedArticlePropertiesStatus === "loading" || !!singleProperty
                            }
                            loading={feedArticlePropertiesStatus === "loading"}
                            value={useArticleProperty}
                            onChange={onChangeFeedArticleProperty}
                          />
                          <ChakraField.HelperText>
                            The article property to display for each article for selection.
                          </ChakraField.HelperText>
                        </ChakraField.Root>
                      </HStack>
                    </Flex>
                    <Stack>
                      <Field label="Search">
                        <HStack flexWrap="wrap" w="full">
                          <InputGroup
                            flex={1}
                            startElement={<FaMagnifyingGlass color="fg.muted" />}
                          >
                            <Input
                              onChange={(e) => setSearch(e.target.value)}
                              placeholder="Search through article property values"
                            />
                          </InputGroup>
                          <Button
                            onClick={() => {
                              if (fetchStatus === "fetching") {
                                return;
                              }

                              refetch();
                            }}
                            aria-label="Refresh list of articles"
                          >
                            {fetchStatus === "fetching" ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <FaArrowsRotate />
                                <span>Refresh Articles</span>
                              </>
                            )}
                          </Button>
                        </HStack>
                      </Field>
                    </Stack>
                    <Stack gap={8} position="relative" rounded="lg">
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
                          <span>
                            <Spinner />
                          </span>
                        </Flex>
                      )}
                      <Stack gap={4} rounded="lg">
                        <Panel
                          surface="transparent"
                          borderRadius="lg"
                          overflow="auto"
                          height="100%"
                          maxHeight={400}
                        >
                          <Menu
                            items={articles.map((article) => {
                              const articleValue = article[useArticleProperty as never];

                              let title: ReactElement;

                              if (!articleValue) {
                                title = <Text color="fg.muted">(empty)</Text>;
                              } else {
                                title = (
                                  <chakra.span whiteSpace="pre-wrap">{articleValue}</chakra.span>
                                );
                              }

                              return {
                                id: article.id,
                                title: title as never,
                                value: article.id,
                                description: "",
                              };
                            })}
                            boxProps={{
                              background: "transparent",
                            }}
                            onSelectedValue={onClickArticle}
                            shown
                          />
                        </Panel>
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
                          onClick={() => {
                            if (onFirstPage || fetchStatus === "fetching") {
                              return;
                            }

                            prevPage();
                          }}
                          aria-disabled={onFirstPage || fetchStatus === "fetching"}
                        >
                          <span>Previous Page</span>
                        </Button>
                        <Button
                          size="sm"
                          width="min-content"
                          onClick={() => {
                            if (onLastPage || fetchStatus === "fetching") {
                              return;
                            }

                            nextPage();
                          }}
                          aria-disabled={onLastPage || fetchStatus === "fetching"}
                        >
                          <span>Next Page</span>
                        </Button>
                      </HStack>
                    </Flex>
                  </Stack>
                )}
              </Box>
              {!alertComponent && (
                <>
                  <Alert.Root role={undefined}>
                    <Alert.Description>
                      <Text fontSize="sm">
                        {t("features.userFeeds.components.articleSelectPrompt.mayBeDelayWarning")}
                      </Text>
                    </Alert.Description>
                  </Alert.Root>
                  {onClickRandomArticle && (
                    <>
                      <Separator />
                      <Button onClick={() => onClickArticle()}>
                        <FaArrowsRotate />
                        <span>
                          {t("features.userFeeds.components.articleSelectPrompt.selectRandom")}
                        </span>
                      </Button>
                    </>
                  )}
                </>
              )}
            </Stack>
          </DialogBody>
          <DialogFooter>
            <Button onClick={onClose}>
              <span>{t("common.buttons.close")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
