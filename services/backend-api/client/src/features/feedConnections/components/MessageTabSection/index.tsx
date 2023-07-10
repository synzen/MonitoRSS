import { RepeatIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { DiscordMessageFormData } from "../../../../types/discord";
import { notifyError } from "../../../../utils/notifyError";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { useUserFeedArticles } from "../../../feed/hooks";
import { UserFeedArticleRequestStatus } from "../../../feed/types";
import { getErrorMessageForArticleRequestStatus } from "../../../feed/utils";
import { ArticlePlaceholderTable } from "../ArticlePlaceholderTable";
import { FeedConnectionType } from "../../../../types";
import { DiscordMessageForm } from "../DiscordMessageForm";

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
    },
  });

  const firstArticle = userFeedArticles?.result.articles[0];
  const requestStatus = userFeedArticles?.result.requestStatus;

  const { t } = useTranslation();

  const onClickRandomFeedArticle = async () => {
    try {
      await refetchUserFeedArticle();
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
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
        <Flex justifyContent="space-between" alignItems="center">
          <Heading as="h2" size="md">
            {t(
              "features.feedConnections.components." +
                "articlePlaceholderTable.headingSamplePlaceholders"
            )}
          </Heading>
          {!hasAlert && (
            <Button
              size="sm"
              leftIcon={<RepeatIcon />}
              isLoading={userFeedArticlesFetchStatus === "fetching"}
              onClick={onClickRandomFeedArticle}
            >
              {t("features.feedConnections.components.articlePlaceholderTable.randomButton")}
            </Button>
          )}
        </Flex>
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
            <ArticlePlaceholderTable asPlaceholders article={userFeedArticles.result.articles[0]} />
          )}
        </Box>
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
