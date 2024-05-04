import { Button } from "@chakra-ui/react";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { FiPlay } from "react-icons/fi";
import { FeedConnectionType } from "../../../../types";
import { notifyError } from "../../../../utils/notifyError";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { ArticleSelectDialog } from "../../../feed/components";
import { CreateDiscordChannelConnectionTestArticleInput } from "../../api";
import { SendTestArticleContext } from "../../../../contexts";

interface Props {
  feedId: string;
  connectionId: string;
  type: FeedConnectionType;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
  previewInput?: CreateDiscordChannelConnectionTestArticleInput;
}

export const SendConnectionTestArticleButton = ({
  feedId,
  connectionId,
  type,
  articleFormatter,
  previewInput,
}: Props) => {
  const { t } = useTranslation();
  const { sendTestArticle, isFetching } = useContext(SendTestArticleContext);

  const onClick = async (articleId?: string) => {
    if (!articleId) {
      return;
    }

    try {
      await sendTestArticle({
        connectionType: type,
        previewInput: {
          feedId,
          connectionId,
          data: {
            article: {
              id: articleId,
            },
            ...previewInput,
          },
        },
      });
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  return (
    <ArticleSelectDialog
      feedId={feedId}
      trigger={
        <Button variant="solid" colorScheme="blue" isLoading={isFetching} leftIcon={<FiPlay />}>
          <span>{t("features.feedConnections.components.sendTestArticleButton.text")}</span>
        </Button>
      }
      onArticleSelected={onClick}
      onClickRandomArticle={onClick}
      articleFormatter={articleFormatter}
    />
  );
};
