import { Button } from "@chakra-ui/react";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { FiPlay } from "react-icons/fi";
import { notifyError } from "../../../../utils/notifyError";
import { ArticleSelectDialog } from "../../../feed/components";
import { SendTestArticleContext } from "../../../../contexts";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";

export const SendConnectionTestArticleButton = () => {
  const { userFeed, connection, articleFormatOptions } = useUserFeedConnectionContext();
  const { t } = useTranslation();
  const { sendTestArticle, isFetching } = useContext(SendTestArticleContext);

  const onClick = async (articleId?: string) => {
    if (!articleId) {
      return;
    }

    try {
      await sendTestArticle({
        connectionType: connection.key,
        previewInput: {
          feedId: userFeed.id,
          connectionId: connection.id,
          data: {
            article: {
              id: articleId,
            },
          },
        },
      });
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  return (
    <ArticleSelectDialog
      articleFormatOptions={articleFormatOptions}
      feedId={userFeed.id}
      trigger={
        <Button variant="solid" colorScheme="blue" isLoading={isFetching} leftIcon={<FiPlay />}>
          <span>{t("features.feedConnections.components.sendTestArticleButton.text")}</span>
        </Button>
      }
      onArticleSelected={onClick}
      onClickRandomArticle={onClick}
    />
  );
};
