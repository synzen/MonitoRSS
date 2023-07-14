import { RepeatIcon, SearchIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  HStack,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiMousePointer } from "react-icons/fi";
import { useState } from "react";
import { DiscordMessageFormData } from "../../../../types/discord";
import { notifyError } from "../../../../utils/notifyError";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { useUserFeedArticles } from "../../../feed/hooks";
import { UserFeedArticleRequestStatus } from "../../../feed/types";
import { getErrorMessageForArticleRequestStatus } from "../../../feed/utils";
import { ArticlePlaceholderTable } from "../ArticlePlaceholderTable";
import { FeedConnectionType } from "../../../../types";
import { DiscordMessageForm } from "../DiscordMessageForm";
import { ArticleSelectPrompt } from "../../../feed/components";

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
    forumThreadTitle?: boolean;
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
      random: true,
      skip: 0,
      selectProperties: ["*"],
      formatter: articleFormatter,
      filters: {
        articleId: selectedArticleId,
      },
    },
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

  const parseErrorAlert = requestStatus &&
    requestStatus !== UserFeedArticleRequestStatus.Success && (
      <Alert status="error">
        <AlertIcon />
        {t(
          getErrorMessageForArticleRequestStatus(
            requestStatus,
            userFeedArticles?.result?.response?.statusCode
          )
        )}
      </Alert>
    );

  const noArticlesAlert = userFeedArticles?.result.articles.length === 0 && (
    <Alert status="info">
      <AlertIcon />
      {t("features.feedConnections.components.articlePlaceholderTable.noArticles")}
    </Alert>
  );

  const hasAlert = !!(fetchErrorAlert || parseErrorAlert || noArticlesAlert);

  return (
    <Stack spacing={12}>
      <Stack spacing={4}>
        <HStack alignItems="center" spacing={4}>
          <Heading as="h2" size="md">
            {t(
              "features.feedConnections.components." +
                "articlePlaceholderTable.headingSamplePlaceholders"
            )}
          </Heading>
          {!hasAlert && (
            <HStack alignItems="center">
              <ArticleSelectPrompt
                trigger={
                  <Button
                    size="sm"
                    leftIcon={<FiMousePointer />}
                    isLoading={!!selectedArticleId && userFeedArticlesFetchStatus === "fetching"}
                    isDisabled={userFeedArticlesFetchStatus === "fetching"}
                  >
                    {t("features.feedConnections.components.articlePlaceholderTable.selectArticle")}
                  </Button>
                }
                feedId={feedId}
                articleFormatter={articleFormatter}
                onArticleSelected={onSelectedArticle}
                onClickRandomArticle={onClickRandomFeedArticle}
              />
              <Button
                size="sm"
                leftIcon={<RepeatIcon />}
                isLoading={!selectedArticleId && userFeedArticlesFetchStatus === "fetching"}
                isDisabled={userFeedArticlesFetchStatus === "fetching"}
                onClick={onClickRandomFeedArticle}
              >
                {t("features.feedConnections.components.articlePlaceholderTable.randomButton")}
              </Button>
            </HStack>
          )}
        </HStack>
        <Stack>
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
          <Box marginBottom="8">
            {fetchErrorAlert || parseErrorAlert || noArticlesAlert}
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
              />
            )}
          </Box>
        </Stack>
      </Stack>
      <Stack spacing={4}>
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
    </Stack>
  );
};
