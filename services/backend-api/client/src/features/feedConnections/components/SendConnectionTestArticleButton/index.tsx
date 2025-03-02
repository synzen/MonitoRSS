import { Button } from "@chakra-ui/react";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { FaDiscord } from "react-icons/fa";
import { notifyError } from "../../../../utils/notifyError";
import { ArticleSelectDialog } from "../../../feed/components";
import { SendTestArticleContext } from "../../../../contexts";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";
import getChakraColor from "../../../../utils/getChakraColor";

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
        <Button
          variant="solid"
          colorScheme="blue"
          isLoading={isFetching}
          leftIcon={<FaDiscord fontSize={24} />}
          color={getChakraColor("gray.700")}
        >
          <span>Send Article to Discord</span>
        </Button>
      }
      onArticleSelected={onClick}
      onClickRandomArticle={onClick}
    />
  );
};
