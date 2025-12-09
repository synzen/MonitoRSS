import { Button } from "@chakra-ui/react";
import { useContext } from "react";
import { FaDiscord } from "react-icons/fa";
import { ArticleSelectDialog } from "../../../feed/components";
import { SendTestArticleContext } from "../../../../contexts";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";
import getChakraColor from "../../../../utils/getChakraColor";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

export const SendConnectionTestArticleButton = () => {
  const { userFeed, connection, articleFormatOptions } = useUserFeedConnectionContext();
  const { sendTestArticle, isFetching } = useContext(SendTestArticleContext);
  const { createErrorAlert, createSuccessAlert, createInfoAlert } = usePageAlertContext();

  const onClick = async (articleId?: string) => {
    if (!articleId) {
      return;
    }

    try {
      const resultInfo = await sendTestArticle(
        {
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
        },
        {
          disableToast: true,
        }
      );

      if (resultInfo?.status === "error") {
        createErrorAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      } else if (resultInfo?.status === "success") {
        createSuccessAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      } else if (resultInfo?.status === "info") {
        createInfoAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      }
    } catch (err) {
      createErrorAlert({
        title: "Failed to send article to Discord.",
        description: (err as Error).message,
      });
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
